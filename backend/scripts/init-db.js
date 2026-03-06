require('dotenv').config();
const { Client } = require('pg');

const adminDatabase = process.env.PGADMIN_DATABASE || 'postgres';
const targetDatabase = process.env.PGDATABASE || process.env.POSTGRES_DATABASE || 'lifeline';

function getAdminClient() {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = `/${adminDatabase}`;
    return new Client({ connectionString: url.toString() });
  }

  return new Client({
    host: process.env.PGHOST || process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.PGPORT || process.env.POSTGRES_PORT || 5432),
    user: process.env.PGUSER || process.env.POSTGRES_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '',
    database: adminDatabase,
  });
}

async function init() {
  const client = getAdminClient();
  await client.connect();

  console.log('Ensuring PostgreSQL database exists:', targetDatabase);
  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDatabase]);
  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE "${targetDatabase.replace(/"/g, '""')}"`);
    console.log('Created database:', targetDatabase);
  } else {
    console.log('Database already exists:', targetDatabase);
  }

  await client.end();
}

init()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('init-db error:', err);
    process.exit(1);
  });
