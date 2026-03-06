#!/usr/bin/env node
const { exportSnapshot } = require('./lib/phase3Migration');

async function main() {
  const runId = process.argv[2];
  const result = await exportSnapshot({ runId });
  console.log(JSON.stringify({ runId: result.runId, snapshotPath: result.snapshotPath, manifestPath: result.manifestPath }, null, 2));
}

main().catch((error) => {
  console.error('[export-mssql-snapshot] Failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
