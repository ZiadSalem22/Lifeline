/**
 * Request Logging Middleware
 * 
 * Logs all incoming HTTP requests with relevant information.
 * 
 * @module middleware/requestLogger
 */

const logger = require('../config/logger');

/**
 * Request logging middleware
 * Logs method, URL, status code, and response time
 * 
 * @param {Express.Request} req - Express request object
 * @param {Express.Response} res - Express response object
 * @param {Express.NextFunction} next - Express next function
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Log when response finishes
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
        };

        if (res.statusCode >= 400) {
            logger.warn('HTTP Request', logData);
        } else {
            logger.info('HTTP Request', logData);
        }
    });

    next();
};

module.exports = requestLogger;
