const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'Todo',
    tableName: 'todos',
    columns: {
        id: { type: 'varchar', primary: true, length: 64 },
        title: { type: 'nvarchar', length: 200, nullable: false },
        description: { type: 'nvarchar', length: 2000, nullable: true },
        due_date: { type: 'datetime', nullable: true },
        is_completed: { type: 'int', default: 0 },
        is_flagged: { type: 'int', default: 0 },
        duration: { type: 'int', default: 0 },
        priority: { type: 'nvarchar', length: 16, default: 'medium' },
        due_time: { type: 'nvarchar', length: 16, nullable: true },
        subtasks: { type: 'nvarchar', length: 'MAX', default: '[]' },
        order: { type: 'int', default: 0 },
        recurrence: { type: 'nvarchar', length: 'MAX', nullable: true },
        next_recurrence_due: { type: 'datetime', nullable: true },
        original_id: { type: 'nvarchar', length: 64, nullable: true },
        task_number: { type: 'int', nullable: true },
        archived: { type: 'int', default: 0 },
        user_id: { type: 'nvarchar', length: 128, nullable: false },
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
