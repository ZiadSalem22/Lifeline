const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'UserSettings',
  tableName: 'user_settings',
  columns: {
    user_id: {
      type: 'text',
      primary: true,
      nullable: false,
    },
    theme: {
      type: 'text',
      nullable: false,
      default: 'system',
    },
    locale: {
      type: 'text',
      nullable: false,
      default: 'en',
    },
    layout: {
      type: 'jsonb',
      nullable: false,
      default: () => "'{}'::jsonb",
    },
    created_at: {
      type: 'timestamptz',
      createDate: true,
      nullable: false,
      default: () => 'now()'
    },
    updated_at: {
      type: 'timestamptz',
      updateDate: true,
      nullable: false,
      default: () => 'now()'
    }
  },
  relations: {
    user: {
      type: 'one-to-one',
      target: 'User',
      joinColumn: { name: 'user_id', referencedColumnName: 'id' },
      inverseSide: 'settings',
      onDelete: 'CASCADE',
    },
  },
});
