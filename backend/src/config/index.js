/**
 * Configuration Module
 * Centralizes environment variables and app configuration.
 */

require('dotenv').config();

const config = {
    server: {
        port: parseInt(process.env.PORT || '3000', 10),
        env: process.env.NODE_ENV || 'development',
    },

    database: {
        path: process.env.DB_PATH || './data/todos_v4.db',
    },

    // CORS configuration that properly supports multiple origins
    cors: {
        origins: (process.env.CORS_ORIGINS
            ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
            : [
                'http://localhost:5173',
                'https://localhost:5173',
                'https://192.168.1.153:5173',
                'https://172.26.176.1:5173'
              ]
        )
    },

    logging: {
        level: process.env.LOG_LEVEL || 'info',
    },
};

module.exports = config;
