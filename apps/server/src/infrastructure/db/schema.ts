import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { Recurrence } from '@lifeline/shared';
import type { SubtaskRecord } from '../../domain/subtask-contract.js';

/**
 * Drizzle schema — EXACT mirror of the live production database
 * (docs/issues/clean-rebuild/discovery/audit-db-schema.md is the normative
 * column-level truth; `migrations/0000_baseline.sql` is the DDL source).
 *
 * Conventions carried over from the old app:
 * - ids are `text` (uuid strings app-side) — never the `uuid` type.
 * - No PG enums: text + CHECK constraints.
 * - All timestamps `timestamptz` defaulting to now(); `updated_at` is
 *   maintained app-side on update.
 */

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    auth0Sub: text('auth0_sub').notNull(),
    email: text('email'),
    name: text('name'),
    picture: text('picture'),
    role: text('role').notNull().default('free'),
    subscriptionStatus: text('subscription_status').notNull().default('none'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('ux_users_auth0_sub').on(t.auth0Sub),
    uniqueIndex('ux_users_email_not_null')
      .on(sql`lower(${t.email})`)
      .where(sql`${t.email} IS NOT NULL`),
    index('ix_users_role').on(t.role),
    index('ix_users_subscription_status').on(t.subscriptionStatus),
    check('chk_users_id_not_blank', sql`char_length(trim(${t.id})) > 0`),
    check('chk_users_auth0_sub_not_blank', sql`char_length(trim(${t.auth0Sub})) > 0`),
    check(
      'chk_users_email_not_blank',
      sql`${t.email} IS NULL OR char_length(trim(${t.email})) > 0`,
    ),
  ],
);

export const userProfiles = pgTable(
  'user_profiles',
  {
    userId: text('user_id').primaryKey(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    phone: text('phone'),
    country: text('country'),
    city: text('city'),
    timezone: text('timezone'),
    avatarUrl: text('avatar_url'),
    onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
    startDayOfWeek: text('start_day_of_week').notNull().default('Monday'),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.userId], foreignColumns: [users.id], name: 'fk_user_profiles_user' })
      .onDelete('cascade')
      .onUpdate('cascade'),
    index('ix_user_profiles_onboarding_completed').on(t.onboardingCompleted),
    index('ix_user_profiles_start_day').on(t.startDayOfWeek),
    check(
      'chk_user_profiles_start_day_of_week',
      sql`${t.startDayOfWeek} IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')`,
    ),
  ],
);

export const userSettings = pgTable(
  'user_settings',
  {
    userId: text('user_id').primaryKey(),
    theme: text('theme').notNull().default('system'),
    locale: text('locale').notNull().default('en'),
    layout: jsonb('layout')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.userId], foreignColumns: [users.id], name: 'fk_user_settings_user' })
      .onDelete('cascade')
      .onUpdate('cascade'),
    check('chk_user_settings_theme_not_blank', sql`char_length(trim(${t.theme})) > 0`),
    check('chk_user_settings_locale_not_blank', sql`char_length(trim(${t.locale})) > 0`),
    check('chk_user_settings_layout_object', sql`jsonb_typeof(${t.layout}) = 'object'`),
  ],
);

export const todos = pgTable(
  'todos',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    /** Per-user sequential number; assigned inside the INSERT (see TodoRepository). */
    taskNumber: integer('task_number').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    dueTime: text('due_time'),
    isCompleted: boolean('is_completed').notNull().default(false),
    isFlagged: boolean('is_flagged').notNull().default(false),
    duration: integer('duration').notNull().default(0),
    priority: text('priority').notNull().default('medium'),
    subtasks: jsonb('subtasks')
      .$type<SubtaskRecord[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** Reserved word — quoted column name "order". */
    order: integer('order').notNull().default(0),
    recurrence: jsonb('recurrence').$type<Recurrence>(),
    /** Dead field in practice (always null); kept for data compatibility. */
    nextRecurrenceDue: timestamp('next_recurrence_due', { withTimezone: true }),
    originalId: text('original_id'),
    archived: boolean('archived').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.userId], foreignColumns: [users.id], name: 'fk_todos_user' })
      .onDelete('cascade')
      .onUpdate('cascade'),
    foreignKey({ columns: [t.originalId], foreignColumns: [t.id], name: 'fk_todos_original' })
      .onDelete('set null')
      .onUpdate('cascade'),
    uniqueIndex('ux_todos_user_task_number').on(t.userId, t.taskNumber),
    index('ix_todos_user_archived_completed').on(t.userId, t.archived, t.isCompleted),
    index('ix_todos_user_due_date').on(t.userId, t.dueDate),
    index('ix_todos_user_flagged').on(t.userId, t.isFlagged),
    index('ix_todos_next_recurrence_due')
      .on(t.userId, t.nextRecurrenceDue)
      .where(sql`${t.nextRecurrenceDue} IS NOT NULL`),
    index('ix_todos_original_id').on(t.originalId),
    index('ix_todos_subtasks_gin').using('gin', t.subtasks),
    index('ix_todos_recurrence_gin').using('gin', t.recurrence),
    // pg_trgm similarity search (old manual migration 008, now in the baseline).
    index('idx_todos_title_trgm').using('gist', t.title.op('gist_trgm_ops')),
    check('chk_todos_id_not_blank', sql`char_length(trim(${t.id})) > 0`),
    check('chk_todos_title_not_blank', sql`char_length(trim(${t.title})) > 0`),
    check('chk_todos_task_number_positive', sql`${t.taskNumber} > 0`),
    check('chk_todos_duration_non_negative', sql`${t.duration} >= 0`),
    check('chk_todos_priority', sql`${t.priority} IN ('low','medium','high')`),
    check('chk_todos_subtasks_array', sql`jsonb_typeof(${t.subtasks}) = 'array'`),
    check(
      'chk_todos_recurrence_object',
      sql`${t.recurrence} IS NULL OR jsonb_typeof(${t.recurrence}) = 'object'`,
    ),
  ],
);

export const tags = pgTable(
  'tags',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    color: text('color').notNull(),
    userId: text('user_id'),
    isDefault: boolean('is_default').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.userId], foreignColumns: [users.id], name: 'fk_tags_user' })
      .onDelete('cascade')
      .onUpdate('cascade'),
    uniqueIndex('ux_tags_default_name')
      .on(sql`lower(${t.name})`)
      .where(sql`${t.isDefault} = true AND ${t.userId} IS NULL`),
    uniqueIndex('ux_tags_custom_name_per_user')
      .on(t.userId, sql`lower(${t.name})`)
      .where(sql`${t.isDefault} = false AND ${t.userId} IS NOT NULL`),
    index('ix_tags_default_user').on(t.isDefault, t.userId),
    index('ix_tags_user_id')
      .on(t.userId)
      .where(sql`${t.userId} IS NOT NULL`),
    index('ix_tags_defaults_only')
      .on(t.isDefault)
      .where(sql`${t.isDefault} = true`),
    check('chk_tags_name_not_blank', sql`char_length(trim(${t.name})) > 0`),
    check('chk_tags_color_not_blank', sql`char_length(trim(${t.color})) > 0`),
    check(
      'chk_tags_default_ownership',
      sql`(${t.isDefault} = true AND ${t.userId} IS NULL) OR (${t.isDefault} = false AND ${t.userId} IS NOT NULL)`,
    ),
  ],
);

export const todoTags = pgTable(
  'todo_tags',
  {
    todoId: text('todo_id').notNull(),
    tagId: text('tag_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.todoId, t.tagId] }),
    foreignKey({ columns: [t.todoId], foreignColumns: [todos.id], name: 'fk_todo_tags_todo' })
      .onDelete('cascade')
      .onUpdate('cascade'),
    foreignKey({ columns: [t.tagId], foreignColumns: [tags.id], name: 'fk_todo_tags_tag' })
      .onDelete('cascade')
      .onUpdate('cascade'),
    index('ix_todo_tags_tag_id').on(t.tagId),
  ],
);

export const mcpApiKeys = pgTable(
  'mcp_api_keys',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    keyHash: text('key_hash').notNull(),
    scopes: jsonb('scopes')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: text('status').notNull().default('active'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    lastUsedIp: text('last_used_ip'),
    lastUsedUserAgent: text('last_used_user_agent'),
    revocationReason: text('revocation_reason'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.userId], foreignColumns: [users.id], name: 'fk_mcp_api_keys_user' })
      .onDelete('cascade')
      .onUpdate('cascade'),
    uniqueIndex('ux_mcp_api_keys_prefix').on(t.keyPrefix),
    index('ix_mcp_api_keys_user_status').on(t.userId, t.status),
    index('ix_mcp_api_keys_expires_at')
      .on(t.expiresAt)
      .where(sql`${t.expiresAt} IS NOT NULL`),
    index('ix_mcp_api_keys_last_used_at')
      .on(t.lastUsedAt)
      .where(sql`${t.lastUsedAt} IS NOT NULL`),
    check('chk_mcp_api_keys_id_not_blank', sql`char_length(trim(${t.id})) > 0`),
    check('chk_mcp_api_keys_name_not_blank', sql`char_length(trim(${t.name})) > 0`),
    check('chk_mcp_api_keys_prefix_not_blank', sql`char_length(trim(${t.keyPrefix})) > 0`),
    check('chk_mcp_api_keys_hash_not_blank', sql`char_length(trim(${t.keyHash})) > 0`),
    check('chk_mcp_api_keys_scopes_array', sql`jsonb_typeof(${t.scopes}) = 'array'`),
    check('chk_mcp_api_keys_status', sql`${t.status} IN ('active','revoked','expired')`),
  ],
);
