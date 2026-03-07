module.exports = class AddMcpApiKeys1772862400000 {
  name = 'AddMcpApiKeys1772862400000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mcp_api_keys (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        name text NOT NULL,
        key_prefix text NOT NULL,
        key_hash text NOT NULL,
        scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
        status text NOT NULL DEFAULT 'active',
        expires_at timestamptz NULL,
        last_used_at timestamptz NULL,
        last_used_ip text NULL,
        last_used_user_agent text NULL,
        revoked_at timestamptz NULL,
        revocation_reason text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_mcp_api_keys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT chk_mcp_api_keys_id_not_blank CHECK (char_length(trim(id)) > 0),
        CONSTRAINT chk_mcp_api_keys_name_not_blank CHECK (char_length(trim(name)) > 0),
        CONSTRAINT chk_mcp_api_keys_prefix_not_blank CHECK (char_length(trim(key_prefix)) > 0),
        CONSTRAINT chk_mcp_api_keys_hash_not_blank CHECK (char_length(trim(key_hash)) > 0),
        CONSTRAINT chk_mcp_api_keys_scopes_array CHECK (jsonb_typeof(scopes) = 'array'),
        CONSTRAINT chk_mcp_api_keys_status CHECK (status IN ('active', 'revoked', 'expired'))
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_mcp_api_keys_prefix ON mcp_api_keys (key_prefix)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_mcp_api_keys_user_status ON mcp_api_keys (user_id, status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_mcp_api_keys_expires_at ON mcp_api_keys (expires_at) WHERE expires_at IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_mcp_api_keys_last_used_at ON mcp_api_keys (last_used_at) WHERE last_used_at IS NOT NULL`);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS mcp_api_keys');
  }
};
