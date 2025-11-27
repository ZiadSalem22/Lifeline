// backend/scripts/init-db.js
require('dotenv').config();
const sql = require('mssql');

const {
  MSSQL_SERVER,
  MSSQL_INSTANCE,
  MSSQL_PORT,
  MSSQL_ADMIN_USERNAME,
  MSSQL_ADMIN_PASSWORD,
  MSSQL_DATABASE,
} = process.env;

// ✅ server is just host (no backslash)
const server = MSSQL_SERVER || 'localhost';

const config = {
  server,
  // optional; you can comment this out if instanceName is used:
  port: MSSQL_PORT ? parseInt(MSSQL_PORT, 10) : undefined,
  user: MSSQL_ADMIN_USERNAME,
  password: MSSQL_ADMIN_PASSWORD,
  database: 'master',
  options: {
    trustServerCertificate: true,
    // ✅ named instance here
    instanceName: MSSQL_INSTANCE || 'SQLEXPRESS01',
  },
};

async function init() {
  const dbName = MSSQL_DATABASE || 'LifelineTodos';

  console.log('Connecting to SQL Server at', server, 'instance', MSSQL_INSTANCE || 'SQLEXPRESS01');
  const pool = await sql.connect(config);

  console.log('Ensuring database exists:', dbName);
  await pool
    .request()
    .input('dbName', sql.NVarChar, dbName)
    .query(`
      IF DB_ID(@dbName) IS NULL
      BEGIN
        PRINT 'Creating database ' + @dbName;
        EXEC('CREATE DATABASE [' + @dbName + ']');
      END
      ELSE
      BEGIN
        PRINT 'Database ' + @dbName + ' already exists.';
      END
    `);

  await pool.close();
  console.log('Done.');
}

init()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('init-db error:', err);
    process.exit(1);
  });
