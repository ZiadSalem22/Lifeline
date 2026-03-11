function normalizeTag(tag) {
  if (!tag) return null;
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    userId: tag.userId || null,
    isDefault: !!tag.isDefault,
  };
}

function createInternalTagHandlers({ createTag, listTags, updateTag, deleteTag }) {
  if (!createTag || !listTags || !deleteTag) {
    throw new Error('createTag, listTags, and deleteTag are required for internal MCP tag handlers');
  }

  return {
    async listTags(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const tags = await listTags.execute(userId);
        return res.json({
          tags: Array.isArray(tags) ? tags.map(normalizeTag).filter(Boolean) : [],
        });
      } catch (error) {
        return next(error);
      }
    },

    async createTag(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const { name, color } = req.body;
        if (!name || !color) {
          return res.status(400).json({ status: 'error', message: 'name and color are required.' });
        }
        const tag = await createTag.execute(userId, name, color);
        return res.status(201).json({ tag: normalizeTag(tag) });
      } catch (error) {
        if (error?.message?.includes('Tag limit')) {
          return res.status(400).json({ status: 'error', message: error.message });
        }
        return next(error);
      }
    },

    async updateTag(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const { id } = req.params;
        const { name, color } = req.body;
        if (!name || !color) {
          return res.status(400).json({ status: 'error', message: 'name and color are required.' });
        }
        if (!updateTag) {
          return res.status(501).json({ status: 'error', message: 'Tag update not available.' });
        }
        const tag = await updateTag.execute(userId, id, name, color);
        return res.json({ tag: normalizeTag(tag) });
      } catch (error) {
        if (error?.message === 'Tag not found') {
          return res.status(404).json({ status: 'error', message: 'Tag not found.' });
        }
        if (error?.message === 'Forbidden') {
          return res.status(403).json({ status: 'error', message: 'Cannot modify this tag.' });
        }
        return next(error);
      }
    },

    async deleteTag(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const { id } = req.params;
        await deleteTag.execute(userId, id);
        return res.json({ deleted: true, id });
      } catch (error) {
        if (error?.message?.includes('Default tags')) {
          return res.status(403).json({ status: 'error', message: error.message });
        }
        if (error?.message === 'Forbidden') {
          return res.status(403).json({ status: 'error', message: 'Cannot delete this tag.' });
        }
        return next(error);
      }
    },
  };
}

module.exports = {
  createInternalTagHandlers,
  normalizeTag,
};
