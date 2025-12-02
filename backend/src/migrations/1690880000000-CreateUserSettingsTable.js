const { Table, TableIndex } = require('typeorm');

module.exports = class CreateUserSettingsTable1690880000000 {
  name = 'CreateUserSettingsTable1690880000000'

  async up(queryRunner) {
    await queryRunner.createTable(new Table({
      name: 'user_settings',
      columns: [
        {
          name: 'id',
          type: 'varchar',
          length: '50',
          isPrimary: true,
          isNullable: false
        },
        {
          name: 'user_id',
          type: 'varchar',
          length: '50',
          isNullable: false
        },
        {
          name: 'theme',
          type: 'varchar',
          length: '50',
          isNullable: true
        },
        {
          name: 'locale',
          type: 'varchar',
          length: '20',
          isNullable: true
        },
        {
          name: 'layout',
          type: 'text',
          isNullable: true
        },
        {
          name: 'created_at',
          type: 'datetime',
          isNullable: false,
          default: "CURRENT_TIMESTAMP"
        },
        {
          name: 'updated_at',
          type: 'datetime',
          isNullable: false,
          default: "CURRENT_TIMESTAMP"
        }
      ]
    }), true);

    await queryRunner.createIndex('user_settings', new TableIndex({
      name: 'IX_user_settings_user_id',
      columnNames: ['user_id']
    }));
  }

  async down(queryRunner) {
    await queryRunner.dropIndex('user_settings', 'IX_user_settings_user_id');
    await queryRunner.dropTable('user_settings');
  }
}
