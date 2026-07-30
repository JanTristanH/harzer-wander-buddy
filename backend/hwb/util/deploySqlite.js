// Temporarily renames db/doNotDeploy-data to db/data so that `cds deploy`
// picks up the seed data, runs the sqlite deploy, and renames the folder
// back afterwards (even if the deploy fails).
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const dbDir = path.join(__dirname, "..", "db");
const hiddenDir = path.join(dbDir, "doNotDeploy-data");
const activeDir = path.join(dbDir, "data");

function renameIfExists(from, to) {
  if (fs.existsSync(from)) {
    fs.renameSync(from, to);
    return true;
  }
  return false;
}

let renamedToActive = false;

try {
  renamedToActive = renameIfExists(hiddenDir, activeDir);

  const result = spawnSync("npx", ["cds", "deploy", "--profile", "development"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    throw result.error;
  }

  process.exitCode = result.status ?? 0;
} finally {
  if (renamedToActive) {
    renameIfExists(activeDir, hiddenDir);
  }
}
