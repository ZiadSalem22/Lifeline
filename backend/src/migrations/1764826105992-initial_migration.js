const { DEFAULT_TAGS } = require('../infra/db/defaultTags');

module.exports = class InitialPostgresSchema1764826105992 {
  name = 'InitialPostgresSchema1764826105992';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY,
        auth0_sub text NOT NULL,
        email text NULL,
        name text NULL,
        picture text NULL,
        role text NOT NULL DEFAULT 'free',
        subscription_status text NOT NULL DEFAULT 'none',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_users_id_not_blank CHECK (char_length(trim(id)) > 0),
        CONSTRAINT chk_users_auth0_sub_not_blank CHECK (char_length(trim(auth0_sub)) > 0),
        CONSTRAINT chk_users_email_not_blank CHECK (email IS NULL OR char_length(trim(email)) > 0)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_users_auth0_sub ON users (auth0_sub)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_not_null ON users (lower(email)) WHERE email IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_users_role ON users (role)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_users_subscription_status ON users (subscription_status)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id text PRIMARY KEY,
        first_name text NULL,
        last_name text NULL,
        phone text NULL,
        country text NULL,
        city text NULL,
        timezone text NULL,
        avatar_url text NULL,
        onboarding_completed boolean NOT NULL DEFAULT false,
        start_day_of_week text NOT NULL DEFAULT 'Monday',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT chk_user_profiles_start_day_of_week CHECK (start_day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'))
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_user_profiles_onboarding_completed ON user_profiles (onboarding_completed)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_user_profiles_start_day ON user_profiles (start_day_of_week)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id text PRIMARY KEY,
        theme text NOT NULL DEFAULT 'system',
        locale text NOT NULL DEFAULT 'en',
        layout jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT chk_user_settings_theme_not_blank CHECK (char_length(trim(theme)) > 0),
        CONSTRAINT chk_user_settings_locale_not_blank CHECK (char_length(trim(locale)) > 0),
        CONSTRAINT chk_user_settings_layout_object CHECK (jsonb_typeof(layout) = 'object')
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        task_number integer NOT NULL,
        title text NOT NULL,
        description text NULL,
        due_date timestamptz NULL,
        due_time text NULL,
        is_completed boolean NOT NULL DEFAULT false,
        is_flagged boolean NOT NULL DEFAULT false,
        duration integer NOT NULL DEFAULT 0,
        priority text NOT NULL DEFAULT 'medium',
        subtasks jsonb NOT NULL DEFAULT '[]'::jsonb,
        "order" integer NOT NULL DEFAULT 0,
        recurrence jsonb NULL,
        next_recurrence_due timestamptz NULL,
        original_id text NULL,
        archived boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_todos_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_todos_original FOREIGN KEY (original_id) REFERENCES todos(id) ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT chk_todos_id_not_blank CHECK (char_length(trim(id)) > 0),
        CONSTRAINT chk_todos_title_not_blank CHECK (char_length(trim(title)) > 0),
        CONSTRAINT chk_todos_task_number_positive CHECK (task_number > 0),
        CONSTRAINT chk_todos_duration_non_negative CHECK (duration >= 0),
        CONSTRAINT chk_todos_priority CHECK (priority IN ('low', 'medium', 'high')),
        CONSTRAINT chk_todos_subtasks_array CHECK (jsonb_typeof(subtasks) = 'array'),
        CONSTRAINT chk_todos_recurrence_object CHECK (recurrence IS NULL OR jsonb_typeof(recurrence) = 'object')
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_todos_user_task_number ON todos (user_id, task_number)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_todos_user_archived_completed ON todos (user_id, archived, is_completed)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_todos_user_due_date ON todos (user_id, due_date)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_todos_user_flagged ON todos (user_id, is_flagged)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_todos_next_recurrence_due ON todos (user_id, next_recurrence_due) WHERE next_recurrence_due IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_todos_original_id ON todos (original_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_todos_subtasks_gin ON todos USING GIN (subtasks)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_todos_recurrence_gin ON todos USING GIN (recurrence)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id text PRIMARY KEY,
        name text NOT NULL,
        color text NOT NULL,
        user_id text NULL,
        is_default boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_tags_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT chk_tags_name_not_blank CHECK (char_length(trim(name)) > 0),
        CONSTRAINT chk_tags_color_not_blank CHECK (char_length(trim(color)) > 0),
        CONSTRAINT chk_tags_default_ownership CHECK ((is_default = true AND user_id IS NULL) OR (is_default = false AND user_id IS NOT NULL))
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_tags_default_name ON tags ((lower(name))) WHERE is_default = true AND user_id IS NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_tags_custom_name_per_user ON tags (user_id, lower(name)) WHERE is_default = false AND user_id IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_tags_default_user ON tags (is_default, user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_tags_user_id ON tags (user_id) WHERE user_id IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_tags_defaults_only ON tags (is_default) WHERE is_default = true`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS todo_tags (
        todo_id text NOT NULL,
        tag_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (todo_id, tag_id),
        CONSTRAINT fk_todo_tags_todo FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_todo_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_todo_tags_tag_id ON todo_tags (tag_id)`);

    for (const tag of DEFAULT_TAGS) {
      const safeId = tag.id.replace(/'/g, "''");
      const safeName = tag.name.replace(/'/g, "''");
      const safeColor = tag.color.replace(/'/g, "''");
      await queryRunner.query(`
        INSERT INTO tags (id, name, color, user_id, is_default)
        SELECT '${safeId}', '${safeName}', '${safeColor}', NULL, true
        WHERE NOT EXISTS (
          SELECT 1 FROM tags WHERE is_default = true AND user_id IS NULL AND lower(name) = lower('${safeName}')
        )
      `);
    }
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS todo_tags');
    await queryRunner.query('DROP TABLE IF EXISTS tags');
    await queryRunner.query('DROP TABLE IF EXISTS todos');
    await queryRunner.query('DROP TABLE IF EXISTS user_settings');
    await queryRunner.query('DROP TABLE IF EXISTS user_profiles');
    await queryRunner.query('DROP TABLE IF EXISTS users');
  }
};
