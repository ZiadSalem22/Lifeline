import type { RequestHandler, Router } from 'express';
import type pg from 'pg';
import type { Env } from './config/env.js';
import type { Logger } from './config/logger.js';
import { createDb, createPool, type Db } from './infrastructure/db/client.js';
import { DrizzleUserRepository } from './infrastructure/repositories/user-repository.js';
import { DrizzleProfileRepository } from './infrastructure/repositories/profile-repository.js';
import { DrizzleSettingsRepository } from './infrastructure/repositories/settings-repository.js';
import { DrizzleTodoRepository } from './infrastructure/repositories/todo-repository.js';
import { DrizzleTagRepository } from './infrastructure/repositories/tag-repository.js';
import { DrizzleMcpKeyRepository } from './infrastructure/repositories/mcp-key-repository.js';
import { DrizzleDailyPlanRepository } from './infrastructure/repositories/daily-plan-repository.js';
import type {
  DailyPlanRepository,
  ImportTodoWriter,
  McpKeyRepository,
  ProfileRepository,
  SettingsRepository,
  TagRepository,
  TodoRepository,
  UserRepository,
} from './application/ports.js';
import { GetMe } from './application/identity/get-me.js';
import { UpdateProfile } from './application/identity/update-profile.js';
import { UpdateSettings } from './application/identity/update-settings.js';
import { CreateTodo } from './application/todos/create-todo.js';
import { ListTodos } from './application/todos/list-todos.js';
import { GetTodo } from './application/todos/get-todo.js';
import { UpdateTodo } from './application/todos/update-todo.js';
import { SetTodoCompletion } from './application/todos/set-todo-completion.js';
import { ArchiveTodo } from './application/todos/archive-todo.js';
import { BatchTodos } from './application/todos/batch-todos.js';
import { FindSimilarTodos } from './application/todos/find-similar-todos.js';
import { SubtaskOps } from './application/todos/subtask-ops.js';
import { ListTags } from './application/tags/list-tags.js';
import { CreateTag } from './application/tags/create-tag.js';
import { UpdateTag } from './application/tags/update-tag.js';
import { DeleteTag } from './application/tags/delete-tag.js';
import { GetStats } from './application/stats/get-stats.js';
import { ExportData } from './application/data-transfer/export-data.js';
import { ImportData } from './application/data-transfer/import-data.js';
import { ResetAccount } from './application/data-transfer/reset-account.js';
import { IssueMcpKey } from './application/mcp-keys/issue-key.js';
import { ListMcpKeys } from './application/mcp-keys/list-keys.js';
import { RevokeMcpKey } from './application/mcp-keys/revoke-key.js';
import { ResolveKeyPrincipal } from './application/mcp-keys/resolve-key-principal.js';
import {
  buildAuthMiddleware,
  createAuthState,
  requireAuth,
  requirePaid,
  requireRole,
  type AuthState,
  type TokenVerifier,
} from './http/middleware/auth.js';
import { createKeyWriteLimiter, createTodosLimiter } from './http/middleware/rate-limit.js';
import { OpenApiRegistry } from './http/openapi/registry.js';
import { readPackageVersion } from './http/routes/info.js';
import { buildTodosRouter } from './http/routes/todos.js';
import { buildTagsRouter } from './http/routes/tags.js';
import { buildStatsRouter } from './http/routes/stats.js';
import { buildExportRouter } from './http/routes/export.js';
import { buildImportRouter } from './http/routes/import.js';
import { buildAccountRouter } from './http/routes/account.js';
import { buildMcpKeysRouter } from './http/routes/mcp-keys.js';
import { buildDailyPlanRouter } from './http/routes/daily-plan.js';
import { buildMcpRouter } from './mcp/router.js';

/** A feature router mounted under /api/v1 (after the auth gate). */
export interface FeatureRouter {
  path: string;
  router: Router;
}

export interface Container {
  env: Env;
  logger: Logger;
  pool: pg.Pool;
  db: Db;
  repos: {
    users: UserRepository;
    profiles: ProfileRepository;
    settings: SettingsRepository;
    todos: TodoRepository & ImportTodoWriter;
    tags: TagRepository;
    mcpKeys: McpKeyRepository;
    dailyPlans: DailyPlanRepository;
  };
  useCases: {
    getMe: GetMe;
    updateProfile: UpdateProfile;
    updateSettings: UpdateSettings;
    createTodo: CreateTodo;
    listTodos: ListTodos;
    getTodo: GetTodo;
    updateTodo: UpdateTodo;
    setTodoCompletion: SetTodoCompletion;
    archiveTodo: ArchiveTodo;
    batchTodos: BatchTodos;
    findSimilarTodos: FindSimilarTodos;
    subtaskOps: SubtaskOps;
    listTags: ListTags;
    createTag: CreateTag;
    updateTag: UpdateTag;
    deleteTag: DeleteTag;
    getStats: GetStats;
    exportData: ExportData;
    importData: ImportData;
    resetAccount: ResetAccount;
    issueMcpKey: IssueMcpKey;
    listMcpKeys: ListMcpKeys;
    revokeMcpKey: RevokeMcpKey;
    /** Consumed by the embedded MCP module (phase 7), not by an HTTP route. */
    resolveKeyPrincipal: ResolveKeyPrincipal;
  };
  auth: {
    /** The /api/v1 gate: verifies the token and attaches req.currentUser. */
    middleware: RequestHandler;
    requireAuth: () => RequestHandler;
    requireRole: (role: string) => RequestHandler;
    requirePaid: () => RequestHandler;
    state: AuthState;
  };
  limiters: {
    todos: RequestHandler;
    keyWrites: RequestHandler;
  };
  registry: OpenApiRegistry;
  version: string;
  /** Feature routers mounted by app.ts under /api/v1 (after the auth gate). */
  featureRouters: FeatureRouter[];
  /**
   * Embedded MCP module (phase 7): POST /mcp + OAuth metadata routes.
   * Mounted by app.ts BEFORE the /api/v1 auth gate — it carries its own
   * dual auth (x-api-key / Bearer).
   */
  mcpRouter: Router;
  /** Graceful shutdown: closes the pg pool. */
  shutdown: () => Promise<void>;
}

export interface ContainerOverrides {
  pool?: pg.Pool | undefined;
  verifier?: TokenVerifier | undefined;
}

/** Wire env → pool → db → repos → use-cases → routers into one typed object. */
export function buildContainer(
  env: Env,
  logger: Logger,
  overrides: ContainerOverrides = {},
): Container {
  const pool = overrides.pool ?? createPool(env.DATABASE_URL, logger);
  const db = createDb(pool);

  const repos = {
    users: new DrizzleUserRepository(db, logger),
    profiles: new DrizzleProfileRepository(db),
    settings: new DrizzleSettingsRepository(db),
    todos: new DrizzleTodoRepository(db),
    tags: new DrizzleTagRepository(db),
    mcpKeys: new DrizzleMcpKeyRepository(db),
    dailyPlans: new DrizzleDailyPlanRepository(db),
  };

  const useCases = {
    getMe: new GetMe(repos),
    updateProfile: new UpdateProfile(repos),
    updateSettings: new UpdateSettings({ settings: repos.settings }),
    createTodo: new CreateTodo({ todos: repos.todos, tags: repos.tags }),
    listTodos: new ListTodos({ todos: repos.todos }),
    getTodo: new GetTodo({ todos: repos.todos }),
    updateTodo: new UpdateTodo({ todos: repos.todos, tags: repos.tags }),
    setTodoCompletion: new SetTodoCompletion({ todos: repos.todos }),
    archiveTodo: new ArchiveTodo({ todos: repos.todos }),
    batchTodos: new BatchTodos({ todos: repos.todos }),
    findSimilarTodos: new FindSimilarTodos({ todos: repos.todos }),
    subtaskOps: new SubtaskOps({ todos: repos.todos }),
    listTags: new ListTags({ tags: repos.tags }),
    createTag: new CreateTag({ tags: repos.tags }),
    updateTag: new UpdateTag({ tags: repos.tags }),
    deleteTag: new DeleteTag({ tags: repos.tags }),
    getStats: new GetStats({ todos: repos.todos }),
    exportData: new ExportData({ todos: repos.todos, tags: repos.tags }),
    importData: new ImportData({ todos: repos.todos }),
    resetAccount: new ResetAccount({
      todos: repos.todos,
      tags: repos.tags,
      settings: repos.settings,
    }),
    issueMcpKey: new IssueMcpKey({ keys: repos.mcpKeys }, { pepper: env.MCP_API_KEY_PEPPER }),
    listMcpKeys: new ListMcpKeys({ keys: repos.mcpKeys }),
    revokeMcpKey: new RevokeMcpKey({ keys: repos.mcpKeys }),
    resolveKeyPrincipal: new ResolveKeyPrincipal(
      { keys: repos.mcpKeys, users: repos.users },
      { pepper: env.MCP_API_KEY_PEPPER },
    ),
  };

  const authState = createAuthState(env);
  const authMiddleware = buildAuthMiddleware(env, {
    users: repos.users,
    profiles: repos.profiles,
    settings: repos.settings,
    logger,
    verifier: overrides.verifier,
  });

  const limiters = {
    todos: createTodosLimiter(),
    keyWrites: createKeyWriteLimiter(),
  };

  const registry = new OpenApiRegistry();

  // The /api/v1/todos limiter is mounted path-wide by app.ts; the key-write
  // limiter is scoped to the two POST routes inside the mcp-keys router.
  const featureRouters: FeatureRouter[] = [
    {
      path: '/todos',
      router: buildTodosRouter({
        createTodo: useCases.createTodo,
        listTodos: useCases.listTodos,
        getTodo: useCases.getTodo,
        updateTodo: useCases.updateTodo,
        setTodoCompletion: useCases.setTodoCompletion,
        archiveTodo: useCases.archiveTodo,
        batchTodos: useCases.batchTodos,
        findSimilarTodos: useCases.findSimilarTodos,
        subtaskOps: useCases.subtaskOps,
        registry,
      }),
    },
    {
      path: '/tags',
      router: buildTagsRouter({
        listTags: useCases.listTags,
        createTag: useCases.createTag,
        updateTag: useCases.updateTag,
        deleteTag: useCases.deleteTag,
        registry,
      }),
    },
    { path: '/stats', router: buildStatsRouter({ getStats: useCases.getStats, registry }) },
    { path: '/export', router: buildExportRouter({ exportData: useCases.exportData, registry }) },
    { path: '/import', router: buildImportRouter({ importData: useCases.importData, registry }) },
    {
      path: '/account',
      router: buildAccountRouter({ resetAccount: useCases.resetAccount, registry }),
    },
    {
      path: '/daily-plan',
      router: buildDailyPlanRouter({ dailyPlans: repos.dailyPlans, registry }),
    },
    {
      path: '/mcp-keys',
      router: buildMcpKeysRouter({
        listKeys: useCases.listMcpKeys,
        issueKey: useCases.issueMcpKey,
        revokeKey: useCases.revokeMcpKey,
        registry,
        limiter: limiters.keyWrites,
      }),
    },
  ];

  const mcpRouter = buildMcpRouter({
    env,
    logger,
    useCases: {
      resolveKeyPrincipal: useCases.resolveKeyPrincipal,
      createTodo: useCases.createTodo,
      listTodos: useCases.listTodos,
      getTodo: useCases.getTodo,
      updateTodo: useCases.updateTodo,
      setTodoCompletion: useCases.setTodoCompletion,
      archiveTodo: useCases.archiveTodo,
      findSimilarTodos: useCases.findSimilarTodos,
      subtaskOps: useCases.subtaskOps,
      listTags: useCases.listTags,
      createTag: useCases.createTag,
      updateTag: useCases.updateTag,
      deleteTag: useCases.deleteTag,
    },
    repos: {
      users: repos.users,
      profiles: repos.profiles,
      settings: repos.settings,
      todos: repos.todos,
    },
  });

  return {
    env,
    logger,
    pool,
    db,
    repos,
    useCases,
    auth: {
      middleware: authMiddleware,
      requireAuth,
      requireRole,
      requirePaid,
      state: authState,
    },
    limiters,
    registry,
    version: readPackageVersion(),
    featureRouters,
    mcpRouter,
    shutdown: async () => {
      await pool.end();
    },
  };
}
