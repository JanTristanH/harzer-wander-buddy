#!/usr/bin/env bash
# Guided companion to docs/pr-previews.md; compatible with macOS Bash 3.2.
set +x
set -euo pipefail
umask 077
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
trap 'unset PREVIEW_ANDROID_KEYSTORE_PASSWORD maps_key; printf "\nEinrichtung abgebrochen. Du kannst das Skript erneut starten.\n" >&2' ERR

usage() {
  cat <<'EOF'
HWB PR-Previews einrichten
  bash scripts/setup-pr-previews.sh          Interaktiver Assistent
  bash scripts/setup-pr-previews.sh --check  Nur lokale Werkzeuge prüfen
  bash scripts/setup-pr-previews.sh --help   Diese Hilfe

Der Assistent führt durch Anmeldung, separates GCP-Projekt mit Billing,
GCP-Ressourcen, GitHub-Environment, Preview-Keystore und Repository-Variablen.
Er erstellt kein GCP-Projekt und startet keinen Build. Änderungen werden
vorher erklärt und bestätigt. Vorhandene Signaturschlüssel bleiben erhalten.
Optionale Vorgaben: PROJECT_ID, REGION, GITHUB_REPOSITORY.
EOF
}
fail() { printf '\n%s\n' "$*" >&2; exit 1; }
ask() {
  local answer
  read -r -p "$* [j/N] " answer
  [[ "$answer" == j || "$answer" == J || "$answer" == ja ]]
}
require_yes() { ask "$*" || fail 'Gestoppt. Nach Klärung erneut starten.'; }
prompt() {
  local answer
  read -r -p "$1${2:+ [$2]}: " answer
  REPLY=${answer:-${2:-}}
  [[ -n "$REPLY" ]] || fail 'Eine Eingabe ist erforderlich.'
}
check_tools() {
  local tool missing=0
  for tool in gh gcloud keytool; do
    if command -v "$tool" >/dev/null 2>&1; then
      if [[ "$tool" == keytool ]] && ! keytool -help >/dev/null 2>&1; then
        printf 'FEHLT: funktionierendes JDK mit keytool\n'; missing=1
      else
        printf 'OK: %s (%s)\n' "$tool" "$(command -v "$tool")"
      fi
    else
      printf 'FEHLT: %s\n' "$tool"; missing=1
    fi
  done
  printf '\nAuf macOS mit Homebrew bei Bedarf installieren:\n'
  printf '  brew install gh\n  brew install --cask gcloud-cli\n  brew install --cask temurin@17  # falls kein JDK vorhanden ist\n'
  printf 'Docker und Android SDK sind für die Einrichtung nicht erforderlich.\n'
  return "$missing"
}
case "${1:-}" in
  --help|-h) usage; exit 0 ;;
  --check) if check_tools; then exit 0; else exit 1; fi ;;
  '') ;;
  *) usage; exit 2 ;;
esac
[[ -t 0 ]] || fail 'Bitte in einem interaktiven Terminal starten; alternativ --check verwenden.'
printf '\nHWB PR-Previews – geführte Einrichtung\n\n1/7 Lokale Werkzeuge\n'
if ! check_tools; then
  if command -v brew >/dev/null 2>&1 && ask 'Fehlende Werkzeuge jetzt mit Homebrew installieren?'; then
    if ! command -v gh >/dev/null 2>&1; then brew install gh; fi
    if ! command -v gcloud >/dev/null 2>&1; then brew install --cask gcloud-cli; fi
    if ! command -v keytool >/dev/null 2>&1 || ! keytool -help >/dev/null 2>&1; then
      brew install --cask temurin@17
    fi
  fi
  check_tools || fail 'Werkzeuge fehlen weiterhin. Terminal neu öffnen und erneut starten.'
fi

printf '\n2/7 Anmeldung und Repository\n'
if ! gh auth status --hostname github.com >/dev/null 2>&1; then
  require_yes 'GitHub-Anmeldung im Browser starten?'
  gh auth login --hostname github.com --web --git-protocol https
fi
account=$(gcloud auth list --filter=status:ACTIVE --format='value(account)')
if [[ -z "$account" ]]; then
  require_yes 'Google-Cloud-Anmeldung im Browser starten?'
  gcloud auth login
  account=$(gcloud auth list --filter=status:ACTIVE --format='value(account)')
fi
[[ -n "$account" ]] || fail 'Kein aktives GCP-Konto vorhanden.'
printf 'Aktives GCP-Konto: %s\n' "$account"
prompt 'GitHub-Repository' "${GITHUB_REPOSITORY:-JanTristanH/harzer-wander-buddy}"
GITHUB_REPOSITORY=$REPLY
[[ "$GITHUB_REPOSITORY" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || fail 'Ungültiges Repository.'
GITHUB_REPOSITORY_ID=$(gh api "repos/$GITHUB_REPOSITORY" --jq .id)
[[ "$GITHUB_REPOSITORY_ID" =~ ^[0-9]+$ ]] || fail 'Repository-ID konnte nicht gelesen werden.'
permission=$(gh api "repos/$GITHUB_REPOSITORY" --jq '.permissions.admin // false')
[[ "$permission" == true ]] || fail 'Für Environment und Actions-Einstellungen werden Repository-Adminrechte benötigt.'

printf '\n3/7 Separates GCP-Preview-Projekt\n'
printf 'Bei Bedarf im Browser ein eigenes Projekt erstellen und Billing verknüpfen:\n'
printf '  https://console.cloud.google.com/projectcreate\n'
printf 'Keine Produktionsprojekt-ID verwenden. Das Projekt muss öffentliche Cloud-Run-Dienste erlauben.\n'
prompt 'Preview-Projekt-ID' "${PROJECT_ID:-}"
PROJECT_ID=$REPLY
[[ "$PROJECT_ID" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] || fail 'Ungültige GCP-Projekt-ID (6–30 Zeichen).'
prompt 'Cloud-Run-Region' "${REGION:-europe-west3}"
REGION=$REPLY
[[ "$REGION" =~ ^[a-z]+-[a-z]+[0-9]+$ ]] || fail 'Ungültige Region.'
gcloud projects describe "$PROJECT_ID" --format='table(projectId,name,projectNumber)'
billing=$(gcloud billing projects describe "$PROJECT_ID" --format='value(billingEnabled)')
[[ "$billing" == True || "$billing" == true ]] || fail "Billing ist nicht aktiv. Verknüpfen unter https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID und erneut starten."
printf '\nBudget mit Benachrichtigung einrichten (kein hartes Kostenlimit):\n'
printf '  https://console.cloud.google.com/billing?project=%s\n' "$PROJECT_ID"
printf 'Cloud Run, GitHub Actions und Registry-Speicher können Kosten verursachen.\n'
require_yes "Ist $PROJECT_ID ein separates Preview-Projekt und sollen dort APIs, Registry, IAM und OIDC eingerichtet werden?"
export PROJECT_ID REGION GITHUB_REPOSITORY GITHUB_REPOSITORY_ID
bash "$ROOT/scripts/setup-gcp-pr-previews.sh"
project_number=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
[[ "$project_number" =~ ^[0-9]+$ ]] || fail 'GCP-Projektnummer fehlt.'

printf '\n4/7 GitHub-Environment pr-preview\n'
printf '  https://github.com/%s/settings/environments\n' "$GITHUB_REPOSITORY"
# Listing first distinguishes a missing environment from authentication/API errors.
environments=$(gh api --paginate "repos/$GITHUB_REPOSITORY/environments" --jq '.environments[].name')
if ! printf '%s\n' "$environments" | grep -Fxq pr-preview; then
  require_yes "Environment pr-preview in $GITHUB_REPOSITORY erstellen?"
  gh api --method PUT "repos/$GITHUB_REPOSITORY/environments/pr-preview" >/dev/null
fi
printf 'Bestehende Schutzregeln werden nicht verändert. Im Browser prüfen:\n'
printf 'Keine verpflichtende Freigabe; PR-Refs und gewünschte Demo-Branches zulassen.\n'
require_yes 'Sind die Environment-Regeln für automatische PR-Previews passend eingestellt?'

printf '\n5/7 Android-Preview-Signatur\n'
secret_names=$(gh secret list --repo "$GITHUB_REPOSITORY" --env pr-preview --json name --jq '.[].name')
has_key=false; has_password=false
if printf '%s\n' "$secret_names" | grep -Fxq PREVIEW_ANDROID_KEYSTORE_BASE64; then has_key=true; fi
if printf '%s\n' "$secret_names" | grep -Fxq PREVIEW_ANDROID_KEYSTORE_PASSWORD; then has_password=true; fi
if $has_key && $has_password; then
  printf 'Beide Signatur-Secrets existieren bereits und werden unverändert weiterverwendet.\n'
  printf 'Bewahre den bisherigen Preview-Keystore und sein Passwort sicher auf.\n'
else
  printf 'Preview-Keystore dauerhaft außerhalb des Repositorys aufbewahren.\n'
  printf 'Bei früheren Preview-Builds unbedingt den bisherigen Schlüssel verwenden.\n'
  prompt 'Absoluter Pfad zum Preview-Keystore (bestehend oder neu)'
  keystore=$REPLY
  [[ "$keystore" == /* && "$keystore" != *$'\n'* ]] || fail 'Bitte einen absoluten Dateipfad eingeben.'
  [[ -d "$(dirname "$keystore")" ]] || fail 'Das Zielverzeichnis muss bereits existieren.'
  key_parent=$(cd "$(dirname "$keystore")" && pwd -P)
  keystore="$key_parent/$(basename "$keystore")"
  case "$keystore" in "$ROOT"/*) fail 'Keystore außerhalb des Repositorys ablegen.' ;; esac
  [[ ! -L "$keystore" ]] || fail 'Für den Keystore keine symbolische Verknüpfung verwenden.'
  if [[ ! -e "$keystore" ]]; then
    if $has_key || $has_password; then
      fail 'Nur eines der Signatur-Secrets existiert. Zum Reparieren den bisherigen Keystore angeben; es wird kein Ersatzschlüssel erzeugt.'
    fi
    require_yes "Neuen, ausschließlich für Previews bestimmten Keystore unter $keystore erzeugen?"
    read -r -s -p 'Neues Keystore-Passwort (mindestens 6 Zeichen): ' PREVIEW_ANDROID_KEYSTORE_PASSWORD; printf '\n'
    read -r -s -p 'Passwort wiederholen: ' password_again; printf '\n'
    [[ ${#PREVIEW_ANDROID_KEYSTORE_PASSWORD} -ge 6 && "$PREVIEW_ANDROID_KEYSTORE_PASSWORD" == "$password_again" ]] || fail 'Passwörter stimmen nicht überein oder sind zu kurz.'
    unset password_again
    export PREVIEW_ANDROID_KEYSTORE_PASSWORD
    keytool -genkeypair -storetype PKCS12 -keystore "$keystore" -alias preview \
      -keyalg RSA -keysize 2048 -validity 3650 -dname 'CN=HWB PR Preview' \
      -storepass:env PREVIEW_ANDROID_KEYSTORE_PASSWORD -keypass:env PREVIEW_ANDROID_KEYSTORE_PASSWORD
    chmod 600 "$keystore"
  else
    [[ -f "$keystore" ]] || fail 'Der Keystore-Pfad muss eine Datei sein.'
    read -r -s -p 'Passwort des bestehenden Preview-Keystores: ' PREVIEW_ANDROID_KEYSTORE_PASSWORD; printf '\n'
    export PREVIEW_ANDROID_KEYSTORE_PASSWORD
  fi
  keytool -list -v -keystore "$keystore" -alias preview -storepass:env PREVIEW_ANDROID_KEYSTORE_PASSWORD
  require_yes 'Ist dies der richtige Preview-Schlüssel und sind Keystore und Passwort dauerhaft gesichert? Signatur-Secrets jetzt hochladen?'
  base64 < "$keystore" | tr -d '\n' | gh secret set PREVIEW_ANDROID_KEYSTORE_BASE64 --repo "$GITHUB_REPOSITORY" --env pr-preview
  printf '%s' "$PREVIEW_ANDROID_KEYSTORE_PASSWORD" | gh secret set PREVIEW_ANDROID_KEYSTORE_PASSWORD --repo "$GITHUB_REPOSITORY" --env pr-preview
  unset PREVIEW_ANDROID_KEYSTORE_PASSWORD
fi

printf '\n6/7 Optional: native Google Maps\n'
printf 'Ohne Maps-Key baut die APK, zeigt aber keine native Karte.\n'
printf 'Maps SDK for Android aktivieren; den Key auf diese API, Preview-Paketnamen\n'
printf 'und den SHA-1-Fingerprint des Keystores beschränken (siehe keytool-Ausgabe).\n'
printf 'Beispiel PR 65: de.kuestenbit.harzerwanderbuddy.preview.pr65\n'
printf '  https://console.cloud.google.com/apis/credentials?project=%s\n' "$PROJECT_ID"
if ask 'Beschränkten Maps-Key als PREVIEW_GOOGLE_MAPS_API_KEY hinterlegen/ersetzen?'; then
  read -r -s -p 'Maps-API-Key: ' maps_key; printf '\n'
  [[ -n "$maps_key" ]] || fail 'Kein Maps-Key eingegeben.'
  printf '%s' "$maps_key" | gh secret set PREVIEW_GOOGLE_MAPS_API_KEY --repo "$GITHUB_REPOSITORY" --env pr-preview
  unset maps_key
fi

printf '\n7/7 Repository-Variablen und Aktivierung\n'
gh variable list --repo "$GITHUB_REPOSITORY"
printf 'Ziel: %s, Projekt: %s, Region: %s\n' "$GITHUB_REPOSITORY" "$PROJECT_ID" "$REGION"
printf 'Die fünf GCP_PREVIEW_*-Repository-Variablen werden gesetzt/ersetzt.\n'
printf 'GCP_PREVIEW_PROJECT_ID aktiviert den Workflow für folgende PR-Ereignisse.\n'
printf 'Falls Previews schon aktiv sind, das Setup ohne parallel laufende Preview-Jobs ausführen.\n'
require_yes 'Konfiguration vollständig und automatische PR-Previews jetzt aktivieren?'
gh variable set GCP_PREVIEW_REGION --repo "$GITHUB_REPOSITORY" --body "$REGION"
gh variable set GCP_PREVIEW_DEPLOY_SERVICE_ACCOUNT --repo "$GITHUB_REPOSITORY" --body "hwb-preview-deploy@$PROJECT_ID.iam.gserviceaccount.com"
gh variable set GCP_PREVIEW_RUNTIME_SERVICE_ACCOUNT --repo "$GITHUB_REPOSITORY" --body "hwb-preview-runtime@$PROJECT_ID.iam.gserviceaccount.com"
gh variable set GCP_PREVIEW_WORKLOAD_IDENTITY_PROVIDER --repo "$GITHUB_REPOSITORY" --body "projects/$project_number/locations/global/workloadIdentityPools/github-previews/providers/github"
gh variable set GCP_PREVIEW_PROJECT_ID --repo "$GITHUB_REPOSITORY" --body "$PROJECT_ID"
printf '\nEinrichtung abgeschlossen. Noch kein Build oder Deployment gestartet.\n'
printf 'Nächster Schritt: Preview-Implementierung per PR nach develop übernehmen;\n'
printf 'dann den gewünschten PR-Branch aktualisieren und einen Commit pushen.\n'
printf 'Zum ersten Test kann auch der offene Preview-Implementierungs-PR dienen.\n'
printf 'Manueller Start erst möglich, wenn der Workflow im Default-Branch liegt:\n'
printf '  gh workflow run pr-preview.yml --repo %q --ref BRANCH -f pr=PR_NUMMER\n' "$GITHUB_REPOSITORY"
printf 'PR-Head muss die Preview-Dateien enthalten; Fork-PRs sind ausgeschlossen.\n'
printf 'Web-Link und APK anschließend unter:\n  https://github.com/%s/actions/workflows/pr-preview.yml\n' "$GITHUB_REPOSITORY"
printf 'Nach dem ersten Deployment auch Login, APK und Cleanup beim Schließen prüfen.\n'
