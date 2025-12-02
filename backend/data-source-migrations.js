require('dotenv').config();
const { DataSource } = require('typeorm');
const path = require('path');

const AppMigrationsDataSource = new DataSource({
  type: 'mssql',
  host: process.env.MSSQL_SERVER || 'localhost',
  port: parseInt(process.env.MSSQL_PORT || '1433', 10),
  username: process.env.MSSQL_USERNAME,
  password: process.env.MSSQL_PASSWORD,
  database: process.env.MSSQL_DATABASE || 'LifelineTodos',
  synchronize: false,
  logging: false,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  extra: {
    instanceName: process.env.MSSQL_INSTANCE || 'SQLEXPRESS',
  },
  entities: [
    path.join(__dirname, 'src', 'infra', 'db', 'entities', 'TodoEntity.js'),
    path.join(__dirname, 'src', 'infra', 'db', 'entities', 'TagEntity.js'),
    path.join(__dirname, 'src', 'infra', 'db', 'entities', 'TodoTagEntity.js'),
    path.join(__dirname, 'src', 'infra', 'db', 'entities', 'UserEntity.js'),
    path.join(__dirname, 'src', 'infra', 'db', 'entities', 'UserProfileEntity.js'),
    path.join(__dirname, 'src', 'infra', 'db', 'entities', 'UserSettingsEntity.js'),
  ],
  migrations: [path.join(__dirname, 'src', 'migrations', '*.js')],
});

module.exports = { AppMigrationsDataSource };
