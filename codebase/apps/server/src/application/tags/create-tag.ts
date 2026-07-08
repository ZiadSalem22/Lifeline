import { randomUUID } from 'node:crypto';
import type { CreateTagInput, Role, Tag } from '@lifeline/shared';
import { assertCustomTagCapacity } from '../../domain/todo-rules.js';
import type { TagRepository } from '../ports.js';

export interface CreateTagDeps {
  tags: TagRepository;
}

/**
 * POST /api/v1/tags — always a custom tag (is_default forced false). Free
 * tier caps at 50 custom tags (403); duplicate names → 409 (from the repo).
 */
export class CreateTag {
  constructor(private readonly deps: CreateTagDeps) {}

  async execute(userId: string, role: Role, input: CreateTagInput): Promise<Tag> {
    const customCount = await this.deps.tags.countCustomByUser(userId);
    assertCustomTagCapacity(role, customCount);
    return this.deps.tags.create(userId, {
      id: randomUUID(),
      name: input.name,
      color: input.color,
    });
  }
}
