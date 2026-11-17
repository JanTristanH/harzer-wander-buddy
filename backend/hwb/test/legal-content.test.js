const assert = require('node:assert/strict');
const { test } = require('node:test');
const { legalDocuments, registerLegalRoutes } = require('../srv/legal-content');

test('prepared Supabase Auth copy distinguishes project region, retention and migration status', () => {
  const result = legalDocuments({});
  const text = result.documents.privacy.text;
  assert.match(text, /eu-west-2 \(London, Vereinigtes Königreich\)/);
  assert.match(text, /europe-west1 \(Belgien\)/);
  assert.match(text, /Supabase Auth im Free-Tarif/);
  assert.match(text, /Supabase Pte\. Ltd\. \(Singapur\)/);
  assert.match(text, /GitHub Pages/);
  assert.match(text, /Domain und E-Mail werden bei STRATO/);
  assert.match(text, /400 Tage/);
  assert.match(text, /keine vom Betreiber konfigurierten Projekt-Backups/);
  assert.match(text, /keine pauschale Löschfrist für sämtliche Auth-Daten/);
  assert.doesNotMatch(text, /US-4|14 Monate|Auth0 Free/);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missing, ['LEGAL_TRANSFER_DETAILS', 'SUPABASE_AUTH_MIGRATION']);
});

test('environment values cannot declare the unimplemented Auth migration ready', () => {
  const result = legalDocuments({
    LEGAL_TRANSFER_DETAILS: 'Confirmed operator-specific transfer arrangements',
    SUPABASE_AUTH_MIGRATION: 'true',
    LEGAL_AUTH_RETENTION: 'Configured Supabase retention',
    LEGAL_AUTH0_RETENTION: 'Obsolete Auth0 retention must not be used',
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.missing, ['SUPABASE_AUTH_MIGRATION']);
  assert.match(result.documents.privacy.text, /Configured Supabase retention/);
  assert.doesNotMatch(result.documents.privacy.text, /Obsolete Auth0 retention/);
  for (const key of ['privacy', 'deletion']) {
    assert.match(result.documents[key].text, /Entwurf für die Umstellung/);
    assert.match(result.documents[key].text, /Staging-Abnahme stehen noch aus/);
    assert.match(result.documents[key].text, /Supabase-Auth-Anmeldekontos/);
  }
});

test('public privacy and deletion HTML show the migration warning', () => {
  const routes = new Map();
  registerLegalRoutes({ get: (path, ...handlers) => routes.set(path, handlers.at(-1)) }, () => {});
  for (const path of ['/legal/datenschutz', '/legal/konto-loeschen']) {
    let html;
    const res = { set() { return this; }, type() { return this; }, send(body) { html = body; } };
    routes.get(path)({}, res);
    assert.match(html, /role="status">Entwurf: Supabase-Auth-Umstellung/);
    assert.match(html, /Staging-Abnahme stehen noch aus/);
  }
});
