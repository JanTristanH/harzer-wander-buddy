// EAS Update does not read build.profile.env from eas.json. Fail before
// publishing if the selected EAS environment would use the local backend.
const expectedBackendUrl = 'https://app.harzer-wander-buddy.de';
const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim().replace(/\/+$/, '');

if (backendUrl !== expectedBackendUrl) {
  console.error(
    `Set EXPO_PUBLIC_BACKEND_URL to ${expectedBackendUrl} in the selected EAS environment (plaintext or sensitive visibility).`
  );
  process.exit(1);
}

console.log('OTA backend configuration verified.');
