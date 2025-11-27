const Tag = require('../domain/Tag');
const { v4: uuidv4 } = require('uuid');

class CreateTag {
    constructor(tagRepository) {
        this.tagRepository = tagRepository;
    }

    async execute(userId, name, color) {
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

    async execute(id) {
        await this.tagRepository.delete(id);
    }
}

class UpdateTag {
    constructor(tagRepository) {
        this.tagRepository = tagRepository;
    }

    async execute(userId, id, name, color) {
        const tag = new Tag(id, name, color, userId, false);
        await this.tagRepository.save(tag);
        return tag;
    }
}

module.exports = { CreateTag, ListTags, DeleteTag, UpdateTag };
