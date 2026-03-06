const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'UserProfile',
  tableName: 'user_profiles',
  columns: {
    user_id: {
      type: 'text',
      primary: true,
      nullable: false,
    },
    first_name: {
      type: 'text',
      nullable: true,
    },
    last_name: {
      type: 'text',
      nullable: true,
    },
    phone: {
      type: 'text',
      nullable: true,
    },
    country: {
      type: 'text',
      nullable: true,
    },
    city: {
      type: 'text',
      nullable: true,
    },
    timezone: {
      type: 'text',
      nullable: true,
    },
    start_day_of_week: {
      type: 'text',
      nullable: false,
      default: 'Monday',
    },
    avatar_url: {
      type: 'text',
      nullable: true,
    },
    onboarding_completed: {
      type: 'boolean',
      nullable: false,
      default: false,
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
    },
  },
  relations: {
    user: {
      type: 'one-to-one',
      target: 'User',
      joinColumn: { name: 'user_id', referencedColumnName: 'id' },
      inverseSide: 'profile',
      onDelete: 'CASCADE',
    },
  },
});
