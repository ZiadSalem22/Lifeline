/**
 * Todo Controller
 * 
 * Handles HTTP requests for todo operations.
 * Implements the controller layer of the MVC pattern.
 * 
 * @module controllers/todoController
 */

const { NotFoundError } = require('../utils/errors');
const logger = require('../config/logger');

/**
 * Todo Controller Class
 * Manages todo-related HTTP request handling
 */
class TodoController {
    /**
     * @param {Object} useCases - Todo use cases
     * @param {Object} useCases.createTodo - Create todo use case
     * @param {Object} useCases.listTodos - List todos use case
     * @param {Object} useCases.toggleTodo - Toggle todo use case
     * @param {Object} useCases.deleteTodo - Delete todo use case
     */
    constructor({ createTodo, listTodos, toggleTodo, deleteTodo }) {
        this.createTodo = createTodo;
        this.listTodos = listTodos;
        this.toggleTodo = toggleTodo;
        this.deleteTodo = deleteTodo;
    }

    /**
     * Get all todos
     * @route GET /api/v1/todos
     * 
     * @param {Express.Request} req - Express request object
     * @param {Express.Response} res - Express response object
     * @param {Express.NextFunction} next - Express next function
     */
    async getAll(req, res, next) {
        try {
            logger.debug('Fetching all todos');
            const todos = await this.listTodos.execute();

            res.status(200).json({
                status: 'success',
                data: { todos },
                meta: { count: todos.length },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Create a new todo
     * @route POST /api/v1/todos
     * 
     * @param {Express.Request} req - Express request object
     * @param {Express.Response} res - Express response object
     * @param {Express.NextFunction} next - Express next function
     */
    async create(req, res, next) {
        try {
            const { title, dueDate, tags, isFlagged, duration } = req.body;

            logger.info('Creating new todo', { title });
            const todo = await this.createTodo.execute(
                title,
                dueDate,
                tags,
                isFlagged,
                duration
            );

            res.status(201).json({
                status: 'success',
                data: { todo },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Toggle todo completion status
     * @route PATCH /api/v1/todos/:id/toggle
     * 
     * @param {Express.Request} req - Express request object
     * @param {Express.Response} res - Express response object
     * @param {Express.NextFunction} next - Express next function
     */
    async toggle(req, res, next) {
        try {
            const { id } = req.params;

            logger.info('Toggling todo', { id });
            const todo = await this.toggleTodo.execute(id);

            if (!todo) {
                throw new NotFoundError('Todo');
            }

            res.status(200).json({
                status: 'success',
                data: { todo },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Toggle todo flag status
     * @route PATCH /api/v1/todos/:id/flag
     * 
     * @param {Express.Request} req - Express request object
     * @param {Express.Response} res - Express response object
     * @param {Express.NextFunction} next - Express next function
     */
    async toggleFlag(req, res, next) {
        try {
            const { id } = req.params;

            logger.info('Toggling todo flag', { id });
            const todo = await this.toggleTodo.execute(id, true);

            if (!todo) {
                throw new NotFoundError('Todo');
            }

            res.status(200).json({
                status: 'success',
                data: { todo },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete a todo
     * @route DELETE /api/v1/todos/:id
     * 
     * @param {Express.Request} req - Express request object
     * @param {Express.Response} res - Express response object
     * @param {Express.NextFunction} next - Express next function
     */
    async delete(req, res, next) {
        try {
            const { id } = req.params;

            logger.info('Deleting todo', { id });
            await this.deleteTodo.execute(id);

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
}

module.exports = TodoController;
