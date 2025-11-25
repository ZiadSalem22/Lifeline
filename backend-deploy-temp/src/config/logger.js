/**
 * Logger Module
 * 
 * Configures Winston logger with console and file transports.
 * Provides structured logging with different levels and formats.
 * 
 * @module logger
 */

const winston = require('winston');
const config = require('../config');

/**
 * Custom log format for better readability
 */
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

/**
 * Winston logger instance
 * @type {winston.Logger}
 */
const logger = winston.createLogger({
    level: config.logging.level,
    format: logFormat,
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                logFormat
            ),
        }),
    ],
});

// Add file transport in production
if (config.server.env === 'production') {
    logger.add(
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error'
        })
    );
    logger.add(
        new winston.transports.File({
            filename: 'logs/combined.log'
        })
    );
}

module.exports = logger;
