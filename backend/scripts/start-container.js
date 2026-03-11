#!/usr/bin/env node
require('dotenv').config();

const path = require('path');
const { spawn } = require('child_process');
const { waitForPostgres } = require('./wait-for-postgres');

function runNodeCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed with exit code ${code}: node ${args.join(' ')}`));
    });
  });
}

async function main() {
  await waitForPostgres();
  await runNodeCommand([require.resolve('typeorm/cli.js'), 'migration:run', '-d', './data-source-migrations.js']);

  const app = require('../src/index');
  const { warmUpAuth } = require('../src/middleware/auth0');
  const port = Number(process.env.PORT || 3000);

  const server = app.listen(port, async () => {
    console.log(`[start-container] Lifeline app listening on port ${port}`);
    try {
      await warmUpAuth();
    } catch (err) {
      console.warn('[start-container] JWKS pre-warm failed; auth will warm on first request', err.message);
    }
  });

  const shutdown = (signal) => {
    console.log(`[start-container] Received ${signal}, shutting down`);
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[start-container] Failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});