/**
 * Error Handling Middleware
 * 
 * Centralized error handling for the application.
 * Catches all errors and sends appropriate responses.
 * 
 * @module middleware/errorHandler
 */

const logger = require('../config/logger');
const { AppError } = require('../utils/errors');

const mapOAuthError = (err) => {
    if (!err) return null;

    if (err.name === 'InvalidRequestError') {
        return new AppError('Missing or invalid Authorization header. Provide a valid Bearer token.', 401);
    }

    if (err.code === 'invalid_token' || err.name === 'UnauthorizedError') {
        return new AppError('Invalid or expired access token.', 401);
    }

    return null;
};

/**
 * Global error handling middleware
 * 
 * @param {Error} err - Error object
 * @param {Express.Request} req - Express request object
 * @param {Express.Response} res - Express response object
 * @param {Express.NextFunction} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
    let error = mapOAuthError(err) || err;

    // Convert non-AppError errors to AppError
    if (!(error instanceof AppError)) {
        const statusCode = error.statusCode || 500;
        const message = error.message || 'Internal Server Error';
        error = new AppError(message, statusCode, false);
    }

    // Log error
    if (error.statusCode >= 500) {
        logger.error('Server Error:', {
            message: error.message,
            stack: error.stack,
            url: req.originalUrl,
            method: req.method,
        });
    } else {
        logger.warn('Client Error:', {
            message: error.message,
            url: req.originalUrl,
            method: req.method,
        });
    }

    // Send error response
    res.status(error.statusCode).json({
        status: 'error',
        message: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
};

/**
 * 404 Not Found handler
 * 
 * @param {Express.Request} req - Express request object
 * @param {Express.Response} res - Express response object
 */
const notFoundHandler = (req, res) => {
    res.status(404).json({
        status: 'error',
        message: `Route ${req.originalUrl} not found`,
    });
};

module.exports = {
    errorHandler,
    notFoundHandler,
};
