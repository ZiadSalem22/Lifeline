/**
 * Configuration Module
 * 
 * Centralizes all application configuration using environment variables.
 * Provides type-safe access to configuration values with sensible defaults.
 * 
 * @module config
 */

require('dotenv').config();

/**
 * Application configuration object
 * @typedef {Object} AppConfig
 * @property {Object} server - Server configuration
 * @property {number} server.port - Server port number
 * @property {string} server.env - Environment (development/production)
 * @property {Object} database - Database configuration
 * @property {string} database.path - SQLite database file path
 * @property {Object} cors - CORS configuration
 * @property {string} cors.origin - Allowed CORS origin
 * @property {Object} logging - Logging configuration
 * @property {string} logging.level - Log level (error/warn/info/debug)
 */

/**
 * @type {AppConfig}
 */
const config = {
    server: {
        port: parseInt(process.env.PORT || '3000', 10),
        env: process.env.NODE_ENV || 'development',
    },
    database: {
        path: process.env.DB_PATH || './data/todos_v4.db',
    },
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173'||'https://192.168.1.153:5173'
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
    },
};

module.exports = config;
