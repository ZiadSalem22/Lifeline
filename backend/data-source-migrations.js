require('dotenv').config();
const { DataSource } = require('typeorm');
const { buildAppDataSourceOptions } = require('./src/infra/db/data-source-options');

const AppMigrationsDataSource = new DataSource(buildAppDataSourceOptions({ includeMigrations: true }));

module.exports = { AppMigrationsDataSource };
