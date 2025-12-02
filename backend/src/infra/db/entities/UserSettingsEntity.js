const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'UserSettings',
  tableName: 'user_settings',
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
    theme: {
      type: 'nvarchar',
      length: 32,
      nullable: true,
    },
    locale: {
      type: 'nvarchar',
      length: 10,
      nullable: true,
    },
    layout: {
      type: 'nvarchar',
      length: 'max',
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
    }
  }
});
