/**
 * Validation Middleware
 * 
 * Provides middleware functions for validating request data using Joi schemas.
 * 
 * @module middleware/validate
 */

const { ValidationError } = require('../utils/errors');

/**
 * Creates a validation middleware for the specified schema and source
 * 
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} source - Source of data to validate ('body', 'params', 'query')
 * @returns {Function} Express middleware function
 * 
 * @example
 * router.post('/todos', validate(createTodoSchema, 'body'), todoController.create);
 */
const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[source], {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            const message = error.details
                .map(detail => detail.message)
                .join(', ');
            return next(new ValidationError(message));
        }

        // Replace request data with validated and sanitized data
        req[source] = value;
        next();
    };
};

module.exports = validate;
