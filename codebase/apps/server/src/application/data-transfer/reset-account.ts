import type { SettingsRepository, TagRepository, TodoRepository } from '../ports.js';

/**
 * POST /api/v1/account/reset — ported from the old `/api/reset-account`
 * (audit-domain-logic.md §10): hard-deletes the user's todos (todo_tags
 * cascade), custom tags, and the settings row. Keeps the user row, profile,
 * and MCP API keys.
 */

export interface ResetAccountDeps {
  todos: Pick<TodoRepository, 'deleteAllByUser'>;
  tags: Pick<TagRepository, 'deleteCustomByUser'>;
  settings: Pick<SettingsRepository, 'deleteByUser'>;
}

export class ResetAccount {
  constructor(private readonly deps: ResetAccountDeps) {}

  async execute(userId: string): Promise<void> {
    await this.deps.todos.deleteAllByUser(userId);
    await this.deps.tags.deleteCustomByUser(userId);
    await this.deps.settings.deleteByUser(userId);
  }
}
