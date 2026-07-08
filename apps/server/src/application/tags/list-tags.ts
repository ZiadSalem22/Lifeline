import type { Tag } from '@lifeline/shared';
import type { TagRepository } from '../ports.js';

export interface ListTagsDeps {
  tags: TagRepository;
}

/**
 * GET /api/v1/tags — global defaults + the user's custom tags, defaults first
 * then lower(name). Plain array (documented pagination exception).
 */
export class ListTags {
  constructor(private readonly deps: ListTagsDeps) {}

  execute(userId: string): Promise<Tag[]> {
    return this.deps.tags.listVisible(userId);
  }
}
