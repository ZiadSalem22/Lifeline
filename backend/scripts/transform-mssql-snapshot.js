#!/usr/bin/env node
const { readJson, transformSnapshot } = require('./lib/phase3Migration');

async function main() {
  const snapshotPath = process.argv[2];
  if (!snapshotPath) {
    throw new Error('Usage: node scripts/transform-mssql-snapshot.js <snapshotPath>');
  }

  const snapshot = readJson(snapshotPath);
  const result = transformSnapshot(snapshot);
  console.log(JSON.stringify({ runId: result.runId, transformedPath: result.transformedPath, reportPath: result.reportPath, success: result.report.success }, null, 2));
  if (!result.report.success) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error('[transform-mssql-snapshot] Failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
