const { DataSource } = require('typeorm');
require('reflect-metadata');
const { buildAppDataSourceOptions } = require('./data-source-options');

const AppDataSource = new DataSource(buildAppDataSourceOptions());

module.exports = { AppDataSource };
