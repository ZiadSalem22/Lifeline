import { ForbiddenError, NotFoundError } from '../../domain/errors.js';
import type { TagRepository } from '../ports.js';

export interface DeleteTagDeps {
  tags: TagRepository;
}

/**
 * DELETE /api/v1/tags/:id → 204. Unknown tag → 404 (v1 contract; the old app
 * silently no-opped), default tag → 403, foreign custom tag → 403.
 */
export class DeleteTag {
  constructor(private readonly deps: DeleteTagDeps) {}

  async execute(userId: string, tagId: string): Promise<void> {
    const existing = await this.deps.tags.findById(tagId);
    if (existing === null) throw new NotFoundError('Tag not found.');
    if (existing.isDefault) throw new ForbiddenError('Default tags cannot be deleted.');
    if (existing.userId !== userId) throw new ForbiddenError('You do not own this tag.');
    await this.deps.tags.delete(userId, tagId);
  }
}
