const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'Todo',
    tableName: 'todos',
    columns: {
        id: { type: 'varchar', primary: true },
        title: { type: 'nvarchar', nullable: false },
        description: { type: 'nvarchar', nullable: true },
        due_date: { type: 'nvarchar', nullable: true },
        is_completed: { type: 'int', default: 0 },
        is_flagged: { type: 'int', default: 0 },
        duration: { type: 'int', default: 0 },
        priority: { type: 'nvarchar', default: 'medium' },
        due_time: { type: 'nvarchar', nullable: true },
        subtasks: { type: 'nvarchar', default: '[]' },
        order: { type: 'int', default: 0 },
        recurrence: { type: 'nvarchar', nullable: true },
        next_recurrence_due: { type: 'nvarchar', nullable: true },
        original_id: { type: 'nvarchar', nullable: true }
    },
    relations: {
        tags: {
            type: 'many-to-many',
            target: 'Tag',
            joinTable: {
                name: 'todo_tags',
                joinColumn: { name: 'todo_id', referencedColumnName: 'id' },
                inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' }
            }
        }
    }
});
