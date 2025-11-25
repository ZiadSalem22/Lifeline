/**
 * Tag Routes
 * 
 * Defines API routes for tag operations.
 * 
 * @module routes/tagRoutes
 */

const express = require('express');
const validate = require('../middleware/validate');
const { createTagSchema, uuidParamSchema } = require('../validators');

/**
 * Creates tag router with controller
 * 
 * @param {TagController} tagController - Tag controller instance
 * @returns {Express.Router} Express router
 */
const createTagRoutes = (tagController) => {
    const router = express.Router();

    /**
     * @route GET /api/v1/tags
     * @desc Get all tags
     * @access Public
     */
    router.get('/', tagController.getAll.bind(tagController));

    /**
     * @route POST /api/v1/tags
     * @desc Create a new tag
     * @access Public
     */
    router.post(
        '/',
        validate(createTagSchema, 'body'),
        tagController.create.bind(tagController)
    );

    /**
     * @route DELETE /api/v1/tags/:id
     * @desc Delete a tag
     * @access Public
     */
    router.delete(
        '/:id',
        validate(uuidParamSchema, 'params'),
        tagController.delete.bind(tagController)
    );

    return router;
};

module.exports = createTagRoutes;
