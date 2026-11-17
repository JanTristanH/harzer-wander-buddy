const fs = require('node:fs/promises');
const path = require('node:path');
const cds = require('@sap/cds');

async function compileRuntimeModel(destination = 'srv/csn.json') {
  await cds.plugins;
  const model = await cds.load('*');
  // Keep service @source annotations so CAP still finds the sibling JS handlers.
  const json = cds.compile.to.json(model, { cwd: cds.root, src: cds.root, indents: 0 });
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, json);
}

if (require.main === module) {
  compileRuntimeModel(process.argv[2]).catch(error => {
    console.error('Runtime model compilation failed:', error.message);
    process.exitCode = 1;
  });
}
module.exports = compileRuntimeModel;
