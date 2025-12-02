const { DataSource } = require('typeorm');
require('reflect-metadata');

const AppDataSource = new DataSource({
    type: 'mssql',
    host: process.env.MSSQL_SERVER || 'localhost',
    port: Number(process.env.MSSQL_PORT) || 1433,
    username: process.env.MSSQL_USERNAME,
    password: process.env.MSSQL_PASSWORD,
    database: process.env.MSSQL_DATABASE || 'LifelineTodos',

    extra: {
        instanceName: process.env.MSSQL_INSTANCE || 'SQLEXPRESS'
    },

    entities: [
        require('./entities/TodoEntity'),
        require('./entities/TagEntity'),
        require('./entities/TodoTagEntity'),
        require('./entities/UserEntity'),
        require('./entities/UserProfileEntity'),
        require('./entities/UserSettingsEntity')
    ],

    synchronize: false,
    logging: true,

    options: {
        encrypt: false,
        trustServerCertificate: true,
    }
});

module.exports = { AppDataSource };
