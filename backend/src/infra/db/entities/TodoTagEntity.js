const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'TodoTag',
    tableName: 'todo_tags',
    columns: {
            todo_id: { type: 'text', primary: true },
            tag_id: { type: 'text', primary: true },
            created_at: { type: 'timestamptz', createDate: true, nullable: false, default: () => 'now()' },
    },
    relations: {
        todo: {
            type: 'many-to-one',
            target: 'Todo',
            joinColumn: { name: 'todo_id', referencedColumnName: 'id' }
        },
        tag: {
            type: 'many-to-one',
            target: 'Tag',
            joinColumn: { name: 'tag_id', referencedColumnName: 'id' }
        }
    }
});
