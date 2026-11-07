// EAS Update does not read build.profile.env. Validate the selected environment
// before publishing, with the same public configuration as native builds.
function validateAuthEnvironment(env) {
  const errors = [];
  let backend, project;
  try { backend = new URL(env.EXPO_PUBLIC_BACKEND_URL); } catch { /* reported below */ }
  try { project = new URL(env.EXPO_PUBLIC_SUPABASE_URL); } catch { /* reported below */ }
  if (backend?.protocol !== 'https:') errors.push('EXPO_PUBLIC_BACKEND_URL must be explicit HTTPS');
  if (project?.protocol !== 'https:') errors.push('EXPO_PUBLIC_SUPABASE_URL must be explicit HTTPS');
  if (!env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) errors.push('Supabase Publishable-Key required');
  if (env.OTA_ENVIRONMENT !== 'production' && backend?.hostname === 'app.harzer-wander-buddy.de') errors.push('Preview requires an isolated staging backend');
  return errors;
}
if (require.main === module) {
  const errors = validateAuthEnvironment(process.env);
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log('OTA public auth environment verified; actual provider acceptance remains required.');
}
module.exports = { validateAuthEnvironment };
