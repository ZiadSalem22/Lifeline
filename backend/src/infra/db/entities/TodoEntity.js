const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'Todo',
    tableName: 'todos',
    columns: {
        id: { type: 'text', primary: true },
        user_id: { type: 'text', nullable: false },
        task_number: { type: 'integer', nullable: false },
        title: { type: 'text', nullable: false },
        description: { type: 'text', nullable: true },
        due_date: { type: 'timestamptz', nullable: true },
        due_time: { type: 'text', nullable: true },
        is_completed: { type: 'boolean', default: false },
        is_flagged: { type: 'boolean', default: false },
        duration: { type: 'integer', default: 0 },
        priority: { type: 'text', default: 'medium' },
        subtasks: { type: 'jsonb', default: () => "'[]'::jsonb" },
        order: { type: 'integer', default: 0 },
        recurrence: { type: 'jsonb', nullable: true },
        next_recurrence_due: { type: 'timestamptz', nullable: true },
        original_id: { type: 'text', nullable: true },
        archived: { type: 'boolean', default: false },
        created_at: { type: 'timestamptz', createDate: true, nullable: false, default: () => 'now()' },
        updated_at: { type: 'timestamptz', updateDate: true, nullable: false, default: () => 'now()' },
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
        },
    }
});
