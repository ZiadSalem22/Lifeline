#!/usr/bin/env node
const { exportSnapshot, transformSnapshot, resetTargetDatabase, importSnapshot, validateTarget } = require('./lib/phase3Migration');

async function main() {
  const runId = process.argv[2];
  const exported = await exportSnapshot({ runId });
  const transformed = transformSnapshot(exported.snapshot, { runId: exported.runId });
  if (!transformed.report.success) {
    console.error('[rehearse-migration] Transform produced rejects. See report:', transformed.reportPath);
    process.exit(2);
    return;
  }

  await resetTargetDatabase();
  const imported = await importSnapshot(transformed.transformed, { runId: exported.runId });
  const validated = await validateTarget({ sourceSnapshot: exported.snapshot, transformedSnapshot: transformed.transformed, runId: exported.runId });

  console.log(JSON.stringify({
    runId: exported.runId,
    snapshotPath: exported.snapshotPath,
    transformedPath: transformed.transformedPath,
    importReportPath: imported.reportPath,
    validationReportPath: validated.reportPath,
    validationSuccess: validated.report.success,
  }, null, 2));

  if (!validated.report.success) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error('[rehearse-migration] Failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
