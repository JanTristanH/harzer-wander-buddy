/** @type {import('expo/fingerprint').Config} */
module.exports = {
  // SemVer and EAS build numbers do not change native API compatibility.
  // Keep Expo's default script normalization when adding this exclusion.
  sourceSkips: [
    'ExpoConfigVersions',
    'PackageJsonAndroidAndIosScriptsIfNotContainRun',
  ],
};
