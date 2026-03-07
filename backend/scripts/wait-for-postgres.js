#!/usr/bin/env node
require('dotenv').config();

const { Client } = require('pg');
const { buildPgClientConfig, parseBoolean } = require('../src/infra/db/data-source-options');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPostgres({ timeoutMs, intervalMs } = {}) {
  const effectiveTimeout = Number(timeoutMs || process.env.DB_WAIT_TIMEOUT_MS || 60000);
  const effectiveInterval = Number(intervalMs || process.env.DB_WAIT_INTERVAL_MS || 2000);
  const deadline = Date.now() + effectiveTimeout;
  const baseConfig = buildPgClientConfig();
  const maskedConfig = {
    host: baseConfig.host || baseConfig.connectionString || 'database-url',
    port: baseConfig.port || 'default',
    database: baseConfig.database || 'from-url',
    ssl: parseBoolean(process.env.PGSSL, false),
  };

  while (Date.now() < deadline) {
    const client = new Client(baseConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log('[wait-for-postgres] PostgreSQL is ready', maskedConfig);
      return true;
    } catch (error) {
      try {
        await client.end();
      } catch (_) {}

      console.log('[wait-for-postgres] Waiting for PostgreSQL...', {
        ...maskedConfig,
        error: error.message,
      });
      await sleep(effectiveInterval);
    }
  }

  throw new Error(`[wait-for-postgres] Timed out after ${effectiveTimeout}ms waiting for PostgreSQL`);
}

if (require.main === module) {
  waitForPostgres()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error && error.stack ? error.stack : error);
      process.exit(1);
    });
}

module.exports = { waitForPostgres };