const Tag = require('../domain/Tag');
const { v4: uuidv4 } = require('uuid');

class CreateTag {
    constructor(tagRepository) {
        this.tagRepository = tagRepository;
    }

    async execute(name, color) {
        const tag = new Tag(uuidv4(), name, color);
        await this.tagRepository.save(tag);
        return tag;
    }
}

class ListTags {
    constructor(tagRepository) {
        this.tagRepository = tagRepository;
    }

    async execute() {
        return await this.tagRepository.findAll();
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

    async execute(id, name, color) {
        const tag = new Tag(id, name, color);
        await this.tagRepository.save(tag);
        return tag;
    }
}

module.exports = { CreateTag, ListTags, DeleteTag, UpdateTag };
