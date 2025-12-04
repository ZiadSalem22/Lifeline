require('dotenv').config();
const { DataSource } = require('typeorm');
const path = require('path');

const AppMigrationsDataSource = new DataSource({
  type: 'mssql',
  host: process.env.MSSQL_SERVER,
  port: parseInt(process.env.MSSQL_PORT || '1433', 10),
  username: process.env.MSSQL_USERNAME,
  password: process.env.MSSQL_PASSWORD,
  database: process.env.MSSQL_DATABASE,

  synchronize: false,
  logging: true,

  // IMPORTANT: remove instance
  extra: {},

  options: {
    encrypt: true,
    trustServerCertificate: true,
  },

  entities: [
    path.join(__dirname, 'src', 'infra', 'db', 'entities', '*.js')
  ],

  // Restore full migrations glob so future changes can be applied
  migrations: [
    path.join(__dirname, 'src', 'migrations', '*.js')
  ],
});

module.exports = { AppMigrationsDataSource };
