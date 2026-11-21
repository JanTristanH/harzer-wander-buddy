require('dotenv').config();
const { legalDocuments } = require('../srv/legal-content');
const { deletionConfigured } = require('../srv/account-privacy');
const missing = [...legalDocuments().missing];
if (process.env.ACCOUNT_DELETION_SCHEDULER_CONFIRMED !== 'true') missing.push('Cloud Run account deletion job / scheduler verification');
if (!deletionConfigured()) missing.push('Supabase Admin deletion credentials / dedicated project / HTTPS URL');
if (!process.env.MOBILE_CORS_ORIGINS?.trim()) missing.push('MOBILE_CORS_ORIGINS production allowlist');
if (!process.env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) missing.push('SUPABASE_PUBLISHABLE_KEY');
if (missing.length) {
  console.error('Release blocked: configure and verify ' + missing.join(', '));
  process.exitCode = 1;
} else console.log('Configuration complete. Manual store, provider and legal checks in docs/legal-audit.md still required.');
