const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'UserProfile',
  tableName: 'user_profiles',
  columns: {
    id: {
      type: 'uniqueidentifier',
      primary: true,
      generated: 'uuid',
      nullable: false,
    },
    user_id: {
      type: 'nvarchar',
      length: 64,
      nullable: false,
    },
    first_name: {
      type: 'nvarchar',
      length: 100,
      nullable: true,
    },
    last_name: {
      type: 'nvarchar',
      length: 100,
      nullable: true,
    },
    phone: {
      type: 'nvarchar',
      length: 32,
      nullable: true,
    },
    country: {
      type: 'nvarchar',
      length: 64,
      nullable: true,
    },
    city: {
      type: 'nvarchar',
      length: 64,
      nullable: true,
    },
    timezone: {
      type: 'nvarchar',
      length: 64,
      nullable: true,
    },
    avatar_url: {
      type: 'nvarchar',
      length: 255,
      nullable: true,
    },
    onboarding_completed: {
      type: 'bit',
      nullable: false,
      default: false,
    },
    created_at: {
      type: 'datetime',
      createDate: true,
      nullable: false,
      default: () => 'GETDATE()'
    },
    updated_at: {
      type: 'datetime',
      updateDate: true,
      nullable: false,
      default: () => 'GETDATE()'
    },
  },
  relations: {
    user: {
      type: 'one-to-one',
      target: 'User',
      joinColumn: { name: 'user_id', referencedColumnName: 'id' },
      onDelete: 'CASCADE',
    },
  },
});
