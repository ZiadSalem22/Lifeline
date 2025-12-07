
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'User',
  tableName: 'users',
  columns: {
    auth0_sub: {
      type: String,
      length: 128,
      nullable: false,
      unique: true,
    },
    id: {
      type: String,
      length: 64,
      primary: true,
      nullable: false,
    },
    email: {
      type: String,
      length: 255,
      nullable: true,
    },
    name: {
      type: String,
      length: 255,
      nullable: true,
    },
    picture: {
      type: String,
      length: 512,
      nullable: true,
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
    role: {
      type: 'nvarchar',
      length: 32,
      nullable: true,
      default: null,
    },
    subscription_status: {
      type: 'nvarchar',
      length: 32,
      nullable: false,
      default: () => "'none'",
    },
  },
});
