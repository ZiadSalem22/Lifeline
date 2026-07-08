import type { Tag, UpdateTagInput } from '@lifeline/shared';
import { ForbiddenError, NotFoundError } from '../../domain/errors.js';
import type { TagRepository } from '../ports.js';

export interface UpdateTagDeps {
  tags: TagRepository;
}

/**
 * PATCH /api/v1/tags/:id — 404 unknown, 403 default or not-owner (contract
 * order), 409 duplicate name (from the repo).
 */
export class UpdateTag {
  constructor(private readonly deps: UpdateTagDeps) {}

  async execute(userId: string, tagId: string, input: UpdateTagInput): Promise<Tag> {
    const existing = await this.deps.tags.findById(tagId);
    if (existing === null) throw new NotFoundError('Tag not found.');
    if (existing.isDefault) throw new ForbiddenError('Default tags cannot be modified.');
    if (existing.userId !== userId) throw new ForbiddenError('You do not own this tag.');
    return this.deps.tags.update(userId, tagId, { name: input.name, color: input.color });
  }
}
