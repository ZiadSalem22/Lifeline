import type {
  DayName,
  ListTodosQuery,
  Priority,
  Recurrence,
  Role,
  Tag,
  Todo,
} from '@lifeline/shared';
import type { SubtaskRecord } from '../domain/subtask-contract.js';

/**
 * Application ports (repository interfaces). Drizzle implementations live in
 * `src/infrastructure/repositories/`. Only the identity slice (users,
 * profiles, settings) is implemented in this phase; todo/tag/mcp-key
 * implementations arrive with their feature routers.
 */

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** Claims extracted from a verified Auth0 JWT (or synthesized in local mode). */
export interface AuthClaims {
  sub: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  /** Merged role claims from both namespaces, deduped. */
  roles: string[];
  /**
   * True only when the token actually carried role claims. Decisions #5: the
   * DB `role` column is written ONLY in that case, so `promote-admin` survives
   * logins from tenants that don't attach role claims.
   */
  hasRoleClaims: boolean;
}

export interface UserRecord {
  id: string;
  auth0Sub: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  role: Role;
  subscriptionStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnsureFromClaimsOptions {
  /** Default true (decisions #5). Set false to force role sync from claims. */
  syncRoleOnlyWhenPresent?: boolean | undefined;
}

export interface UserRepository {
  /**
   * Upsert the user row from verified claims. email/name/picture always sync;
   * `role` syncs only when the token carries role claims (see AuthClaims);
   * `subscription_status` is set to 'none' at insert and never clobbered.
   */
  ensureFromClaims(claims: AuthClaims, options?: EnsureFromClaimsOptions): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
  /** Throws ConflictError('Email already in use by another account') on duplicates. */
  updateEmail(userId: string, email: string): Promise<void>;
}

export interface ProfileRecord {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  timezone: string | null;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  startDayOfWeek: DayName;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileUpsert {
  firstName?: string | undefined;
  lastName?: string | undefined;
  phone?: string | null | undefined;
  country?: string | null | undefined;
  city?: string | null | undefined;
  timezone?: string | null | undefined;
  avatarUrl?: string | null | undefined;
  startDayOfWeek?: DayName | undefined;
  onboardingCompleted?: boolean | undefined;
}

export interface ProfileRepository {
  get(userId: string): Promise<ProfileRecord | null>;
  /** Insert-or-update; only defined fields are written. */
  upsert(userId: string, data: ProfileUpsert): Promise<ProfileRecord>;
}

export interface SettingsRecord {
  userId: string;
  theme: string;
  locale: string;
  layout: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingsUpsert {
  theme?: string | undefined;
  locale?: string | undefined;
  layout?: Record<string, unknown> | undefined;
}

export interface SettingsRepository {
  get(userId: string): Promise<SettingsRecord | null>;
  upsert(userId: string, data: SettingsUpsert): Promise<SettingsRecord>;
  /** Account reset deletes the settings row (theme back to defaults). */
  deleteByUser(userId: string): Promise<void>;
}

/** Request-scoped identity attached by the auth middleware as `req.currentUser`. */
export interface CurrentUser {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  role: Role;
  /** Roles from token claims when present, else `[role]` from the DB row. */
  roles: string[];
  subscriptionStatus: string;
  profile: ProfileRecord | null;
  settings: SettingsRecord | null;
}

// ---------------------------------------------------------------------------
// Todos (signatures only in this phase — implemented with the feature router)
// ---------------------------------------------------------------------------

/** Validated list/search filters (shape mirrors `listTodosQuerySchema`). */
export type TodoListFilters = ListTodosQuery;

/** Everything a todo row needs except identity/numbering, which the repo assigns. */
export interface NewTodoData {
  title: string;
  description: string | null;
  dueDate: string | null;
  dueTime: string | null;
  isFlagged: boolean;
  duration: number;
  priority: Priority;
  subtasks: SubtaskRecord[];
  order: number;
  recurrence: Recurrence | null;
  originalId: string | null;
  /** Resolved tag ids (unknown ids must be dropped before this point). */
  tagIds: string[];
}

export interface TodoUpdateData {
  title?: string | undefined;
  description?: string | null | undefined;
  dueDate?: string | null | undefined;
  dueTime?: string | null | undefined;
  isFlagged?: boolean | undefined;
  duration?: number | undefined;
  priority?: Priority | undefined;
  subtasks?: SubtaskRecord[] | undefined;
  order?: number | undefined;
  tagIds?: string[] | undefined;
}

/**
 * Per-create options. `activeCap`, when set, enforces the free-tier active-todo
 * ceiling ATOMICALLY inside the create transaction (count active + assert
 * count+rowsToAdd ≤ cap after acquiring the per-user advisory lock), closing
 * the race where two concurrent creates both pass a pre-transaction check and
 * together exceed the cap. Undefined = no cap (paid/admin).
 */
export interface CreateTodoOptions {
  activeCap?: number | undefined;
}

export interface TodoRepository {
  list(userId: string, filters: TodoListFilters): Promise<{ items: Todo[]; totalItems: number }>;
  /**
   * Unpaginated listing (default sort) for stats/export use-cases. Archived
   * rows are excluded unless `includeArchived` is set.
   */
  listAll(userId: string, options?: { includeArchived?: boolean | undefined }): Promise<Todo[]>;
  /**
   * Insert one todo. `task_number` is assigned INSIDE the insert
   * (`COALESCE(MAX(task_number), 0) + 1` select) within a transaction, with a
   * single retry on unique violation 23505 (fixes the old MAX+1 race). When
   * `options.activeCap` is set the cap is checked inside that same transaction.
   * Throws ForbiddenError('Free tier max tasks reached.') when it would cross.
   */
  create(userId: string, data: NewTodoData, options?: CreateTodoOptions): Promise<Todo>;
  /** Bulk insert for recurrence expansion; same numbering + cap guarantees, one transaction. */
  createMany(userId: string, data: NewTodoData[], options?: CreateTodoOptions): Promise<Todo[]>;
  findById(userId: string, id: string): Promise<Todo | null>;
  findByTaskNumber(userId: string, taskNumber: number): Promise<Todo | null>;
  /** Batch helper: fetch many by id (missing ids simply absent from the result). */
  findByIds(userId: string, ids: string[]): Promise<Todo[]>;
  /** pg_trgm `similarity(title, :title) > threshold`, ordered by similarity DESC. */
  findSimilarByTitle(
    userId: string,
    title: string,
    limit: number,
    threshold: number,
  ): Promise<Todo[]>;
  /** Partial update; never flips `archived` implicitly (fixes old bug #2). */
  update(userId: string, id: string, changes: TodoUpdateData): Promise<Todo>;
  setCompleted(userId: string, id: string, isCompleted: boolean): Promise<Todo>;
  /** Archive/restore. Tags are ALWAYS preserved (decisions #4). */
  setArchived(userId: string, id: string, archived: boolean): Promise<Todo>;
  /** Free-tier cap input: active = non-archived. */
  countActiveByUser(userId: string): Promise<number>;
  /** Account reset / import-replace only. */
  deleteAllByUser(userId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Tags (signatures only in this phase)
// ---------------------------------------------------------------------------

export interface TagRepository {
  /** Global defaults + the user's custom tags, defaults first then lower(name). */
  listVisible(userId: string): Promise<Tag[]>;
  findById(id: string): Promise<Tag | null>;
  countCustomByUser(userId: string): Promise<number>;
  /**
   * Always creates a custom tag (is_default forced false). Throws
   * ConflictError('A tag with this name already exists.') on duplicate name.
   */
  create(userId: string, data: { id: string; name: string; color: string }): Promise<Tag>;
  /**
   * Row-scoped to the owner's custom tags. Existence/ownership guards
   * (404 unknown, 403 default or not-owner) fire in the use-case first;
   * throws NotFoundError if the row vanished and ConflictError on a
   * duplicate name.
   */
  update(
    userId: string,
    tagId: string,
    changes: { name?: string | undefined; color?: string | undefined },
  ): Promise<Tag>;
  /** Row-scoped to the owner's custom tags (guards live in the use-case). */
  delete(userId: string, tagId: string): Promise<void>;
  /** Account reset / import-replace: remove the user's custom tags. */
  deleteCustomByUser(userId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// MCP API keys (signatures only in this phase)
// ---------------------------------------------------------------------------

export interface McpKeyRecord {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  status: 'active' | 'revoked' | 'expired';
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  lastUsedUserAgent: string | null;
  revokedAt: Date | null;
  revocationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface McpKeyRepository {
  /** Inserts with status 'active'. Throws ConflictError on a duplicate key prefix (23505). */
  create(
    data: Pick<McpKeyRecord, 'id' | 'userId' | 'name' | 'keyPrefix' | 'keyHash' | 'scopes'> & {
      expiresAt: Date | null;
    },
  ): Promise<McpKeyRecord>;
  /** The user's keys, newest first (created_at DESC), capped at `limit`. */
  list(userId: string, limit: number): Promise<McpKeyRecord[]>;
  findById(userId: string, keyId: string): Promise<McpKeyRecord | null>;
  /** Resolution path — deliberately NOT filtered by user. */
  findByPrefix(keyPrefix: string): Promise<McpKeyRecord | null>;
  /** Idempotent; 404 when the key doesn't belong to the user. */
  revoke(userId: string, keyId: string, reason: string): Promise<McpKeyRecord>;
  /** Best-effort last-used bookkeeping; callers must not let failures break auth. */
  recordUsage(
    keyId: string,
    usage: { at?: Date | undefined; ip?: string | undefined; userAgent?: string | undefined },
  ): Promise<void>;
}

// ---------------------------------------------------------------------------
// Daily Plan — per-(user, date) plan blobs + a per-user settings blob. Both
// are zod-validated at the route (@lifeline/shared daily-plan schemas), so
// the repository stores/returns them as opaque JSON objects.
// ---------------------------------------------------------------------------

export interface DailyPlanDayRecord {
  planDate: string;
  data: Record<string, unknown>;
}

export interface DailyPlanRepository {
  /** All plan rows for the user in [start, end] (date-only strings), ascending. */
  getRange(userId: string, start: string, end: string): Promise<DailyPlanDayRecord[]>;
  /** Every plan row for the user, ascending — the data-export path. */
  getAllDays(userId: string): Promise<DailyPlanDayRecord[]>;
  upsertDay(
    userId: string,
    planDate: string,
    data: Record<string, unknown>,
  ): Promise<DailyPlanDayRecord>;
  getSettings(userId: string): Promise<Record<string, unknown> | null>;
  upsertSettings(userId: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Data transfer (import) — owned by the stats/data-transfer slice. The
// drizzle implementation belongs with the todo repository (same tables);
// the integrator maps this interface onto DrizzleTodoRepository.
// ---------------------------------------------------------------------------

/**
 * Todo write shape for import: identity (`id`) is preserved from the export
 * file, `task_number` is ALWAYS reassigned server-side (decisions #10 —
 * reassign instead of failing on conflicts), `order` is forced to 0 by the
 * import use-case, and `tagIds` are already remapped/resolved.
 */
export interface ImportTodoData {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueTime: string | null;
  isCompleted: boolean;
  isFlagged: boolean;
  duration: number;
  priority: Priority;
  subtasks: SubtaskRecord[];
  order: number;
  recurrence: Recurrence | null;
  originalId: string | null;
  tagIds: string[];
}

export interface ImportTodoWriter {
  /**
   * Insert-or-overwrite by id (merge-mode id collision = upsert, matching the
   * old repo `save`). `userId` is forced onto the row; unknown tag ids were
   * already dropped by the import use-case.
   */
  upsertImported(userId: string, data: ImportTodoData): Promise<Todo>;

  /**
   * Atomic unit-of-work for POST /api/v1/import (decisions #10 + contract:
   * import is ONE transaction). Runs — inside a single db.transaction under the
   * per-user advisory lock, with the one 23505 retry —:
   *   1. (replace only) delete the user's todos AND custom tags;
   *   2. remap/create the import's tags (custom tags created on demand);
   *   3. upsert every todo row, resolving its raw tag refs through that map.
   *
   * All rows are already normalized/validated by the use-case BEFORE this call,
   * so a bad user payload never reaches here — a failure mid-transaction rolls
   * back the purge, so replace-mode can never lose the pre-existing data.
   * Returns the number of todo rows written.
   */
  importAll(userId: string, plan: ImportPlan): Promise<{ importedCount: number }>;
}

/** A tag entry from the import payload, pre-parsed by the use-case. */
export interface ImportTagInput {
  /** The id this tag had in the export file (used to resolve todo tag refs). */
  oldId: string;
  name: string;
  color: string;
  isDefault: boolean;
}

/**
 * A todo row for {@link ImportTodoWriter.importAll}: fully normalized (subtasks,
 * duration, dates, …) EXCEPT tag resolution — `tagRefs` are the raw old ids
 * from the file, resolved through the import's tag map inside the transaction.
 */
export interface ImportTodoInput extends Omit<ImportTodoData, 'tagIds'> {
  tagRefs: string[];
}

export interface ImportPlan {
  replace: boolean;
  tags: ImportTagInput[];
  todos: ImportTodoInput[];
  /** Id generator for on-demand custom-tag creation (injectable for tests). */
  generateTagId: () => string;
}
