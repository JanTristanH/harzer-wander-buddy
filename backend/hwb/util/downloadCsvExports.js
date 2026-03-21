const fs = require('fs/promises');
const path = require('path');
const fetch = require('node-fetch');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = token.split('=');
    const key = rawKey.slice(2);
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = next;
    i += 1;
  }
  return args;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function safeFileName(entity) {
  return `hwb.db.${entity}.csv`;
}

async function readErrorBody(response) {
  try {
    return await response.text();
  } catch (err) {
    return '';
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true' || args.h === 'true') {
    console.log('Usage: node util/downloadCsvExports.js (--session-cookie <cookie> | --token <bearer-token>) [--base-url <url>] [--out-dir <path>] [--match <regex>]');
    console.log('Defaults:');
    console.log('  --base-url http://localhost:4004');
    console.log('  --out-dir db/doNotDeploy-data');
    console.log('  --match ^hwb\\.db\\..+\\.csv$');
    console.log('Env alternatives: EXPORT_SESSION_COOKIE, EXPORT_BEARER_TOKEN, EXPORT_BASE_URL, EXPORT_OUT_DIR, EXPORT_FILE_MATCH');
    return;
  }

  const baseUrl = normalizeBaseUrl(args['base-url'] || process.env.EXPORT_BASE_URL || 'http://localhost:4004');
  const token = args.token || process.env.EXPORT_BEARER_TOKEN || process.env.BEARER_TOKEN;
  const sessionCookie = args['session-cookie'] || process.env.EXPORT_SESSION_COOKIE || process.env.APP_SESSION_COOKIE;
  const outDir = path.resolve(args['out-dir'] || process.env.EXPORT_OUT_DIR || path.join('db', 'doNotDeploy-data'));
  const matchPattern = args.match || process.env.EXPORT_FILE_MATCH || '^hwb\\.db\\..+\\.csv$';

  if (!sessionCookie && !token) {
    throw new Error('Missing authentication. Provide --session-cookie (preferred) or --token.');
  }

  const fileMatcher = new RegExp(matchPattern);
  const headers = {};
  if (sessionCookie) {
    headers.Cookie = `appSession=${sessionCookie}`;
  } else {
    headers.Authorization = `Bearer ${token}`;
  }

  await fs.mkdir(outDir, { recursive: true });

  const listUrl = `${baseUrl}/export/csv`;
  const listResponse = await fetch(listUrl, { headers });
  if (!listResponse.ok) {
    const errorBody = await readErrorBody(listResponse);
    throw new Error(`Failed to list exports: ${listResponse.status} ${listResponse.statusText}\n${errorBody}`);
  }

  const listJson = await listResponse.json();
  const entities = Array.isArray(listJson.entities) ? listJson.entities : [];
  const candidates = entities
    .map((entry) => {
      const entity = entry.entity;
      if (!entity) {
        return null;
      }

      const fileName = entry.fileName || safeFileName(entity);
      const url = entry.url || `${baseUrl}/export/csv/${encodeURIComponent(entity)}`;
      return { entity, fileName, url };
    })
    .filter(Boolean)
    .filter((entry) => fileMatcher.test(entry.fileName));

  if (candidates.length === 0) {
    console.log(`No export entries matched pattern: ${matchPattern}`);
    return;
  }

  const failures = [];
  for (const item of candidates) {
    const response = await fetch(item.url, { headers });
    if (!response.ok) {
      const errorBody = await readErrorBody(response);
      failures.push(`${item.entity}: ${response.status} ${response.statusText} ${errorBody}`.trim());
      continue;
    }

    const csv = await response.text();
    const destination = path.join(outDir, item.fileName);
    await fs.writeFile(destination, csv, 'utf8');
    console.log(`Downloaded ${item.entity} -> ${destination}`);
  }

  if (failures.length > 0) {
    const details = failures.join('\n');
    throw new Error(`Some exports failed:\n${details}`);
  }

  console.log(`Done. Downloaded ${candidates.length} CSV file(s).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
