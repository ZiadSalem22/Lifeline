const { DataSource } = require('typeorm');
require('reflect-metadata');

const AppDataSource = new DataSource({
    type: 'mssql',
    host: process.env.MSSQL_SERVER,
    port: Number(process.env.MSSQL_PORT || 1433),
    username: process.env.MSSQL_USERNAME,
    password: process.env.MSSQL_PASSWORD,
    database: process.env.MSSQL_DATABASE,

    synchronize: false,
    logging: true,

    // IMPORTANT: remove instance
    extra: {},

    options: {
        encrypt: true,                 // MUST MATCH MIGRATIONS
        trustServerCertificate: false, // For Azure SQL, should be false unless using self-signed certs
    },

    entities: [
        require('./entities/TodoEntity'),
        require('./entities/TagEntity'),
        require('./entities/TodoTagEntity'),
        require('./entities/UserEntity'),
        require('./entities/UserProfileEntity'),
        require('./entities/UserSettingsEntity')
    ],
});

module.exports = { AppDataSource };
