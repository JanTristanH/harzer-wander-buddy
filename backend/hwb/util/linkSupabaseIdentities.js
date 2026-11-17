// Operator-reviewed linking; NEVER matches by email or imports passwords.
const cds = require('@sap/cds');
const { UUID } = require('../srv/supabase-auth');
async function linkIdentities(tx, rows, apply = false) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('Expected a non-empty mapping array');
  const subjects = new Set(), ids = new Set();
  for (const row of rows) {
    if (!UUID.test(row.subject) || typeof row.internalId !== 'string' || !row.internalId ||
        typeof row.proofReference !== 'string' || row.proofReference.trim().length < 8 ||
        subjects.has(row.subject) || ids.has(row.internalId)) throw new Error('Invalid or ambiguous mapping');
    subjects.add(row.subject); ids.add(row.internalId);
  }
  const plan = [];
  for (const row of rows) {
    const profile = await tx.run(cds.ql.SELECT.one.from('hwb.db.ExternalUsers').where({ ID: row.internalId }).forUpdate());
    if (!profile) throw new Error('Legacy profile missing');
    if (await require('../srv/account-privacy').isAccountDeleted(row.internalId)) throw new Error('Deleted account cannot be linked');
    const links = await tx.run(cds.ql.SELECT.from('hwb.db.AuthIdentities').where({ subject: row.subject }).or({ internalId: row.internalId }));
    if (links.length && (links.length !== 1 || links[0].subject !== row.subject || links[0].internalId !== row.internalId || links[0].revokedAt)) throw new Error('Identity mapping collision');
    const newProfile = await tx.run(cds.ql.SELECT.one.from('hwb.db.ExternalUsers').where({ ID: `supabase|${row.subject}` }));
    if (newProfile && row.internalId !== newProfile.ID) throw new Error('Supabase account already owns app data; manual conflict resolution required');
    plan.push({ ...row, exists: !!links.length });
  }
  // Validate the complete batch before making any writes; caller supplies one transaction.
  if (apply) for (const row of plan) if (!row.exists) await tx.run(cds.ql.INSERT.into('hwb.db.AuthIdentities').entries({
    subject: row.subject, internalId: row.internalId, proofReference: row.proofReference, linkedAt: new Date().toISOString(),
  }));
  return { checked: plan.length, existing: plan.filter(row => row.exists).length, create: plan.filter(row => !row.exists).length, applied: apply };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || !args.length) {
    console.log('node util/linkSupabaseIdentities.js mapping.json [--apply]\nDefault: transactional dry-run. --apply requires operator-approved environment and backup. No email matching.'); return;
  }
  if (args.some((arg, i) => i > 0 && arg !== '--apply')) throw new Error('Unknown argument');
  const rows = JSON.parse(require('node:fs').readFileSync(args[0], 'utf8'));
  // Read-only provider preflight. A typed UUID alone is not evidence of an existing account.
  const client = require('../srv/supabase-auth').adminClient();
  for (const row of rows) {
    if (!UUID.test(row.subject)) throw new Error('Invalid subject');
    const { data, error } = await client.auth.admin.getUserById(row.subject);
    if (error || data.user?.id !== row.subject || !data.user.email_confirmed_at) throw new Error('Verified Supabase account required');
  }
  const db = await cds.connect.to('db');
  try { console.log(await db.tx(tx => linkIdentities(tx, rows, args.includes('--apply')))); }
  finally { await db.disconnect(); }
}
if (require.main === module) main().catch(() => { console.error('Identity mapping failed; transaction rolled back.'); process.exitCode = 1; });
module.exports = { linkIdentities };
