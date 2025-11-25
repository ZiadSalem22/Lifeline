/**
 * Todo Routes
 * 
 * Defines API routes for todo operations.
 * 
 * @module routes/todoRoutes
 */

const express = require('express');
const validate = require('../middleware/validate');
const { createTodoSchema, uuidParamSchema } = require('../validators');

/**
 * Creates todo router with controller
 * 
 * @param {TodoController} todoController - Todo controller instance
 * @returns {Express.Router} Express router
 */
const createTodoRoutes = (todoController) => {
    const router = express.Router();

    /**
     * @route GET /api/v1/todos
     * @desc Get all todos
     * @access Public
     */
    router.get('/', todoController.getAll.bind(todoController));

    /**
     * @route POST /api/v1/todos
     * @desc Create a new todo
     * @access Public
     */
    router.post(
        '/',
        validate(createTodoSchema, 'body'),
        todoController.create.bind(todoController)
    );

    /**
     * @route PATCH /api/v1/todos/:id/toggle
     * @desc Toggle todo completion status
     * @access Public
     */
    router.patch(
        '/:id/toggle',
        validate(uuidParamSchema, 'params'),
        todoController.toggle.bind(todoController)
    );

    /**
     * @route PATCH /api/v1/todos/:id/flag
     * @desc Toggle todo flag status
     * @access Public
     */
    router.patch(
        '/:id/flag',
        validate(uuidParamSchema, 'params'),
        todoController.toggleFlag.bind(todoController)
    );

    /**
     * @route DELETE /api/v1/todos/:id
     * @desc Delete a todo
     * @access Public
     */
    router.delete(
        '/:id',
        validate(uuidParamSchema, 'params'),
        todoController.delete.bind(todoController)
    );

    return router;
};

module.exports = createTodoRoutes;
