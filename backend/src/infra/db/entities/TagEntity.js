const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'Tag',
    tableName: 'tags',
    columns: {
        id: { type: 'text', primary: true },
        name: { type: 'text', nullable: false },
        color: { type: 'text', nullable: false },
        user_id: { type: 'text', nullable: true },
        is_default: { type: 'boolean', default: false },
        created_at: { type: 'timestamptz', createDate: true, nullable: false, default: () => 'now()' },
        updated_at: { type: 'timestamptz', updateDate: true, nullable: false, default: () => 'now()' },
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
        },
    }
});
