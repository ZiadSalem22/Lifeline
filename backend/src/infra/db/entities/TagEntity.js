const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'Tag',
    tableName: 'tags',
    columns: {
        id: { type: 'varchar', primary: true },
        name: { type: 'nvarchar', nullable: false },
        color: { type: 'nvarchar', nullable: false }
    },
    relations: {
        todos: {
            type: 'many-to-many',
            target: 'Todo',
            joinTable: {
                name: 'todo_tags',
                joinColumn: { name: 'tag_id', referencedColumnName: 'id' },
                inverseJoinColumn: { name: 'todo_id', referencedColumnName: 'id' }
            }
        }
    }
});
