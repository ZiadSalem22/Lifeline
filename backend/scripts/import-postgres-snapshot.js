#!/usr/bin/env node
const { readJson, importSnapshot } = require('./lib/phase3Migration');

async function main() {
  const transformedPath = process.argv[2];
  if (!transformedPath) {
    throw new Error('Usage: node scripts/import-postgres-snapshot.js <transformedSnapshotPath>');
  }

  const transformed = readJson(transformedPath);
  const result = await importSnapshot(transformed);
  console.log(JSON.stringify({ runId: result.runId, reportPath: result.reportPath, counts: result.report.counts }, null, 2));
}

main().catch((error) => {
  console.error('[import-postgres-snapshot] Failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
