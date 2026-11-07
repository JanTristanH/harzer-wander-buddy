#!/usr/bin/env bash
# Run once as a GCP administrator, against a dedicated, billing-enabled project.
set -euo pipefail
: "${PROJECT_ID:?Set the dedicated preview project ID}"
: "${GITHUB_REPOSITORY:?Set owner/repository}"
: "${GITHUB_REPOSITORY_ID:?Set its numeric GitHub repository ID}"
REGION=${REGION:-europe-west3}
[[ "$GITHUB_REPOSITORY_ID" =~ ^[0-9]+$ && "$GITHUB_REPOSITORY" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || exit 1
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  cloudresourcemanager.googleapis.com --project "$PROJECT_ID"
project_number=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
deployer="hwb-preview-deploy@$PROJECT_ID.iam.gserviceaccount.com"
runtime="hwb-preview-runtime@$PROJECT_ID.iam.gserviceaccount.com"
for account in hwb-preview-deploy hwb-preview-runtime; do
  if ! gcloud iam service-accounts describe "$account@$PROJECT_ID.iam.gserviceaccount.com" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$account" --project "$PROJECT_ID"
  fi
done
if ! gcloud artifacts repositories describe hwb-previews --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud artifacts repositories create hwb-previews --repository-format docker --location "$REGION" --project "$PROJECT_ID"
fi
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$deployer" --role roles/run.admin --condition=None >/dev/null
gcloud artifacts repositories add-iam-policy-binding hwb-previews --location "$REGION" --project "$PROJECT_ID" \
  --member "serviceAccount:$deployer" --role roles/artifactregistry.writer >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$runtime" --project "$PROJECT_ID" \
  --member "serviceAccount:$deployer" --role roles/iam.serviceAccountUser >/dev/null
if ! gcloud iam workload-identity-pools describe github-previews --location global --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create github-previews --location global --project "$PROJECT_ID" --display-name 'GitHub PR previews'
fi
condition="assertion.repository_id == '$GITHUB_REPOSITORY_ID' && assertion.sub == 'repo:$GITHUB_REPOSITORY:environment:pr-preview' && assertion.workflow_ref.startsWith('$GITHUB_REPOSITORY/.github/workflows/pr-preview.yml@')"
provider_args=(--workload-identity-pool github-previews --location global --project "$PROJECT_ID"
  --issuer-uri https://token.actions.githubusercontent.com
  --attribute-mapping 'google.subject=assertion.sub,attribute.repository_id=assertion.repository_id'
  --attribute-condition "$condition")
if gcloud iam workload-identity-pools providers describe github --workload-identity-pool github-previews --location global --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers update-oidc github "${provider_args[@]}"
else
  gcloud iam workload-identity-pools providers create-oidc github "${provider_args[@]}"
fi
gcloud iam service-accounts add-iam-policy-binding "$deployer" --project "$PROJECT_ID" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$project_number/locations/global/workloadIdentityPools/github-previews/attribute.repository_id/$GITHUB_REPOSITORY_ID" >/dev/null
cat <<EOF
Set these GitHub repository Actions variables:
GCP_PREVIEW_PROJECT_ID=$PROJECT_ID
GCP_PREVIEW_REGION=$REGION
GCP_PREVIEW_DEPLOY_SERVICE_ACCOUNT=$deployer
GCP_PREVIEW_RUNTIME_SERVICE_ACCOUNT=$runtime
GCP_PREVIEW_WORKLOAD_IDENTITY_PROVIDER=projects/$project_number/locations/global/workloadIdentityPools/github-previews/providers/github
EOF
