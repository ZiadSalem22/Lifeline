const Tag = require('../domain/Tag');
const { v4: uuidv4 } = require('uuid');

class CreateTag {
    constructor(tagRepository) {
        this.tagRepository = tagRepository;
    }

    async execute(userId, name, color, limits) {
        // Enforce free-tier custom tag limit (default tags excluded)
        if (limits && limits.maxTags) {
            const count = await this.tagRepository.countCustomByUser(userId);
            if (count >= limits.maxTags) {
                throw new Error('Tag limit reached for free tier');
            }
        }
        const tag = new Tag(uuidv4(), name, color, userId, false);
        await this.tagRepository.save(tag);
        return tag;
    }
}

class ListTags {
    constructor(tagRepository) {
        this.tagRepository = tagRepository;
    }

    async execute(userId) {
        return await this.tagRepository.findAllForUser(userId);
    }
}

class DeleteTag {
    constructor(tagRepository) {
        this.tagRepository = tagRepository;
    }

    async execute(userId, id) {
        await this.tagRepository.delete(id, userId);
    }
}

class UpdateTag {
    constructor(tagRepository) {
        this.tagRepository = tagRepository;
    }

    async execute(userId, id, name, color) {
        const existing = await this.tagRepository.findById(id);
        if (!existing) throw new Error('Tag not found');
        if (existing.isDefault || existing.userId !== userId) {
            throw new Error('Forbidden');
        }
        existing.name = name;
        existing.color = color;
        await this.tagRepository.save(existing);
        return existing;
    }
}

module.exports = { CreateTag, ListTags, DeleteTag, UpdateTag };
