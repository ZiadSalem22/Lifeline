const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'McpApiKey',
  tableName: 'mcp_api_keys',
  columns: {
    id: { type: 'text', primary: true, nullable: false },
    user_id: { type: 'text', nullable: false },
    name: { type: 'text', nullable: false },
    key_prefix: { type: 'text', nullable: false },
    key_hash: { type: 'text', nullable: false },
    scopes: { type: 'jsonb', nullable: false, default: () => "'[]'::jsonb" },
    status: { type: 'text', nullable: false, default: 'active' },
    expires_at: { type: 'timestamptz', nullable: true },
    last_used_at: { type: 'timestamptz', nullable: true },
    last_used_ip: { type: 'text', nullable: true },
    last_used_user_agent: { type: 'text', nullable: true },
    revoked_at: { type: 'timestamptz', nullable: true },
    revocation_reason: { type: 'text', nullable: true },
    created_at: { type: 'timestamptz', createDate: true, nullable: false, default: () => 'now()' },
    updated_at: { type: 'timestamptz', updateDate: true, nullable: false, default: () => 'now()' },
  },
  relations: {
    user: {
      type: 'many-to-one',
      target: 'User',
      joinColumn: { name: 'user_id', referencedColumnName: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
  },
});
