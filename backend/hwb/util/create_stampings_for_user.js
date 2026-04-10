const fs = require('fs');
const path = require('path');

const WORKDIR = path.resolve(__dirname, '..');
const STAMPBOXES = path.join(WORKDIR, 'db', 'doNotDeploy-data', 'hwb.db.Stampboxes.csv');
const STAMPINGS = path.join(WORKDIR, 'db', 'doNotDeploy-data', 'hwb.db.Stampings.csv');

const USER = 'auth0|69b5331c62387e627ead7b0d';

function readLines(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
}

function randomDate(start, end) {
  const s = start.getTime();
  const e = end.getTime();
  const t = new Date(s + Math.floor(Math.random() * (e - s + 1)));
  t.setMilliseconds(Math.floor(Math.random() * 1000));
  return t.toISOString();
}

function main() {
  if (!fs.existsSync(STAMPBOXES)) {
    console.error('Stampboxes file not found:', STAMPBOXES);
    process.exit(1);
  }
  if (!fs.existsSync(STAMPINGS)) {
    console.error('Stampings file not found:', STAMPINGS);
    process.exit(1);
  }

  const boxLines = readLines(STAMPBOXES);
  const stampingLines = readLines(STAMPINGS);

  const existing = new Set();
  // header: ID,stamp_ID,visitedAt,createdAt,createdBy
  for (let i = 1; i < stampingLines.length; i++) {
    const cols = stampingLines[i].split(',');
    const stampId = cols[1];
    const createdBy = cols[4];
    if (createdBy === USER) existing.add(stampId);
  }

  const start = new Date('2024-01-01T00:00:00.000Z');
  const end = new Date();

  let added = 0;
  const toAppend = [];

  for (let i = 1; i < boxLines.length; i++) {
    const line = boxLines[i];
    const parts = line.split(',');
    const boxId = parts[0];
    if (!boxId) continue;
    if (existing.has(boxId)) continue;

    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : require('crypto').randomUUID();
    const visitedAt = randomDate(start, end);
    const createdAt = new Date().toISOString();
    const row = [id, boxId, visitedAt, createdAt, USER].join(',');
    toAppend.push(row);
    added++;
  }

  if (toAppend.length > 0) {
    fs.appendFileSync(STAMPINGS, '\n' + toAppend.join('\n'));
  }

  console.log('Added stampings for user', USER, 'count=', added);
}

if (require.main === module) main();
