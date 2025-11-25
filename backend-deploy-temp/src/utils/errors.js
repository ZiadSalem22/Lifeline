/**
 * Custom Error Classes
 * 
 * Defines application-specific error types for better error handling
 * and more meaningful error messages.
 * 
 * @module errors
 */

/**
 * Base application error class
 * @extends Error
 */
class AppError extends Error {
    /**
     * @param {string} message - Error message
     * @param {number} statusCode - HTTP status code
     * @param {boolean} isOperational - Whether error is operational (expected)
     */
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error thrown when a resource is not found
 * @extends AppError
 */
class NotFoundError extends AppError {
    /**
     * @param {string} resource - Name of the resource not found
     */
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
    }
}

/**
 * Error thrown when validation fails
 * @extends AppError
 */
class ValidationError extends AppError {
    /**
     * @param {string} message - Validation error message
     */
    constructor(message) {
        super(message, 400);
    }
}

/**
 * Error thrown when a database operation fails
 * @extends AppError
 */
class DatabaseError extends AppError {
    /**
     * @param {string} message - Database error message
     * @param {Error} originalError - Original database error
     */
    constructor(message, originalError) {
        super(message, 500);
        this.originalError = originalError;
    }
}

module.exports = {
    AppError,
    NotFoundError,
    ValidationError,
    DatabaseError,
};
