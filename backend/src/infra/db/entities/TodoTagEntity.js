const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'TodoTag',
    tableName: 'todo_tags',
    columns: {
            todo_id: { type: 'nvarchar', primary: true },
            tag_id: { type: 'nvarchar', primary: true }
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
