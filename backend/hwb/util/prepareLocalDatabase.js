const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, '..', 'db.sqlite');
const target = path.join(__dirname, '..', 'db.local.db');

// Seed local development once, then keep all local visits and profile edits.
try {
  fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  console.log('Created local development database: db.local.db');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}
