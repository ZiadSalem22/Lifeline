
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'User',
  tableName: 'users',
  columns: {
    id: {
      type: 'text',
      primary: true,
      nullable: false,
    },
    auth0_sub: {
      type: 'text',
      nullable: false,
    },
    email: {
      type: 'text',
      nullable: true,
    },
    name: {
      type: 'text',
      nullable: true,
    },
    picture: {
      type: 'text',
      nullable: true,
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
    role: {
      type: 'text',
      nullable: false,
      default: 'free',
    },
    subscription_status: {
      type: 'text',
      nullable: false,
      default: 'none',
    },
  },
  relations: {
    profile: {
      type: 'one-to-one',
      target: 'UserProfile',
      inverseSide: 'user',
    },
    settings: {
      type: 'one-to-one',
      target: 'UserSettings',
      inverseSide: 'user',
    },
  },
});
