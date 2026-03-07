/**
 * Validation Schemas
 * 
 * Defines Joi validation schemas for request validation.
 * Ensures data integrity and provides clear error messages.
 * 
 * @module validators
 */

const Joi = require('joi');

/**
 * Schema for creating a new todo
 */
const createTodoSchema = Joi.object({
    title: Joi.string()
        .trim()
        .min(1)
        .max(500)
        .required()
        .messages({
            'string.empty': 'Title cannot be empty',
            'string.max': 'Title must be less than 500 characters',
            'any.required': 'Title is required',
        }),
    dueDate: Joi.string()
        .isoDate()
        .allow(null)
        .optional(),
    tags: Joi.array()
        .items(
            Joi.object({
                id: Joi.string().required(),
                name: Joi.string().required(),
                color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).required(),
            })
        )
        .default([]),
    isFlagged: Joi.boolean()
        .default(false),
    duration: Joi.number()
        .integer()
        .min(0)
        .max(1440) // Max 24 hours in minutes
        .default(0)
        .messages({
            'number.max': 'Duration cannot exceed 24 hours',
        }),
});

/**
 * Schema for creating a new tag
 */
const createTagSchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(1)
        .max(50)
        .required()
        .messages({
            'string.empty': 'Tag name cannot be empty',
            'string.max': 'Tag name must be less than 50 characters',
            'any.required': 'Tag name is required',
        }),
    color: Joi.string()
        .pattern(/^#[0-9A-Fa-f]{6}$/)
        .required()
        .messages({
            'string.pattern.base': 'Color must be a valid hex color (e.g., #FF5733)',
            'any.required': 'Color is required',
        }),
});

/**
 * Schema for creating a self-serve MCP API key.
 */
const createMcpApiKeySchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(1)
        .max(100)
        .required()
        .messages({
            'string.empty': 'API key name cannot be empty',
            'string.max': 'API key name must be less than 100 characters',
            'any.required': 'API key name is required',
        }),
    scopePreset: Joi.string()
        .valid('read_only', 'read_write')
        .required()
        .messages({
            'any.only': 'scopePreset must be one of: read_only, read_write',
            'any.required': 'scopePreset is required',
        }),
    expiryPreset: Joi.string()
        .valid('1_day', '7_days', '30_days', '90_days', 'never')
        .required()
        .messages({
            'any.only': 'expiryPreset must be one of: 1_day, 7_days, 30_days, 90_days, never',
            'any.required': 'expiryPreset is required',
        }),
});

/**
 * Schema for listing self-serve MCP API keys.
 */
const listMcpApiKeysQuerySchema = Joi.object({
    limit: Joi.number()
        .integer()
        .min(1)
        .max(50)
        .default(25)
        .messages({
            'number.base': 'limit must be a number',
            'number.integer': 'limit must be a whole number',
            'number.min': 'limit must be at least 1',
            'number.max': 'limit must be 50 or less',
        }),
});

/**
 * Schema for UUID parameters
 */
const uuidParamSchema = Joi.object({
    id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.guid': 'Invalid ID format',
            'any.required': 'ID is required',
        }),
});

module.exports = {
    createTodoSchema,
    createTagSchema,
    createMcpApiKeySchema,
    listMcpApiKeysQuerySchema,
    uuidParamSchema,
};
