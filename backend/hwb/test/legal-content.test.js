const assert = require('node:assert/strict');
const { test } = require('node:test');
const { legalDocuments } = require('../srv/legal-content');

test('confirmed Free deployment is disclosed with distinct regions, logs and provider backups', () => {
  const result = legalDocuments({});
  const text = result.documents.privacy.text;
  assert.match(text, /eu-west-2 \(London, Vereinigtes Königreich\)/);
  assert.match(text, /europe-west1 \(Belgien\)/);
  assert.match(text, /US-4 \(USA\)/);
  assert.match(text, /GitHub Pages/);
  assert.match(text, /Domain und E-Mail werden bei STRATO/);
  assert.match(text, /Auth0 Free/);
  assert.match(text, /14 Monaten/);
  assert.match(text, /400 Tage/);
  assert.match(text, /keine Projekt-Backups/);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missing, ['LEGAL_TRANSFER_DETAILS']);
});
