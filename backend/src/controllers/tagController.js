/**
 * Tag Controller
 * 
 * Handles HTTP requests for tag operations.
 * 
 * @module controllers/tagController
 */

const logger = require('../config/logger');

/**
 * Tag Controller Class
 */
class TagController {
    /**
     * @param {Object} useCases - Tag use cases
     * @param {Object} useCases.createTag - Create tag use case
     * @param {Object} useCases.listTags - List tags use case
     * @param {Object} useCases.deleteTag - Delete tag use case
     */
    constructor({ createTag, listTags, deleteTag }) {
        this.createTag = createTag;
        this.listTags = listTags;
        this.deleteTag = deleteTag;
    }

    /**
     * Get all tags
     * @route GET /api/v1/tags
     */
    async getAll(req, res, next) {
        try {
            logger.debug('Fetching all tags');
            const tags = await this.listTags.execute();

            res.status(200).json({
                status: 'success',
                data: { tags },
                meta: { count: tags.length },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Create a new tag
     * @route POST /api/v1/tags
     */
    async create(req, res, next) {
        try {
            const { name, color } = req.body;

            logger.info('Creating new tag', { name, color });
            const tag = await this.createTag.execute(name, color);

            res.status(201).json({
                status: 'success',
                data: { tag },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete a tag
     * @route DELETE /api/v1/tags/:id
     */
    async delete(req, res, next) {
        try {
            const { id } = req.params;

            logger.info('Deleting tag', { id });
            await this.deleteTag.execute(id);

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
}

module.exports = TagController;
