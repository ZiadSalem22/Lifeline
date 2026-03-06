#!/usr/bin/env node
const { readJson, validateTarget } = require('./lib/phase3Migration');

async function main() {
  const snapshotPath = process.argv[2];
  const transformedPath = process.argv[3];
  if (!snapshotPath || !transformedPath) {
    throw new Error('Usage: node scripts/validate-postgres-migration.js <snapshotPath> <transformedSnapshotPath>');
  }

  const sourceSnapshot = readJson(snapshotPath);
  const transformedSnapshot = readJson(transformedPath);
  const result = await validateTarget({ sourceSnapshot, transformedSnapshot });
  console.log(JSON.stringify({ runId: result.runId, reportPath: result.reportPath, success: result.report.success, checks: result.report.checks }, null, 2));
  if (!result.report.success) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error('[validate-postgres-migration] Failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
