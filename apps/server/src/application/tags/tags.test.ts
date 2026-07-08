import { describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors.js';
import { InMemoryTagRepository } from '../../../test/helpers/feature-fakes.js';
import { ListTags } from './list-tags.js';
import { CreateTag } from './create-tag.js';
import { UpdateTag } from './update-tag.js';
import { DeleteTag } from './delete-tag.js';

function build() {
  const tags = new InMemoryTagRepository();
  tags.seedDefaults();
  return {
    tags,
    listTags: new ListTags({ tags }),
    createTag: new CreateTag({ tags }),
    updateTag: new UpdateTag({ tags }),
    deleteTag: new DeleteTag({ tags }),
  };
}

describe('ListTags', () => {
  it('returns defaults first, then own custom by lower(name); excludes foreign customs', async () => {
    const { tags, listTags } = build();
    tags.seedCustom('u1', { name: 'zeta' });
    tags.seedCustom('u1', { name: 'Alpha' });
    tags.seedCustom('other', { name: 'NotMine' });
    const visible = await listTags.execute('u1');
    expect(visible).toHaveLength(12); // 10 defaults + 2 custom
    expect(visible.slice(0, 10).every((tag) => tag.isDefault)).toBe(true);
    expect(visible.slice(10).map((tag) => tag.name)).toEqual(['Alpha', 'zeta']);
    expect(visible.some((tag) => tag.name === 'NotMine')).toBe(false);
  });
});

describe('CreateTag', () => {
  it('creates a custom tag (is_default forced false)', async () => {
    const { createTag } = build();
    const tag = await createTag.execute('u1', 'free', { name: 'Garden', color: '#00FF00' });
    expect(tag).toMatchObject({ name: 'Garden', color: '#00FF00', userId: 'u1', isDefault: false });
  });

  it('free tier caps at 50 custom tags; paid bypasses', async () => {
    const { tags, createTag } = build();
    for (let i = 0; i < 50; i += 1) tags.seedCustom('u1', { name: `tag-${i}` });
    await expect(
      createTag.execute('u1', 'free', { name: 'one-too-many', color: '#000000' }),
    ).rejects.toThrow(new ForbiddenError('Free tier max tags reached.'));
    await expect(
      createTag.execute('u1', 'paid', { name: 'paid-is-fine', color: '#000000' }),
    ).resolves.toMatchObject({ name: 'paid-is-fine' });
  });

  it('duplicate name (case-insensitive) → conflict', async () => {
    const { tags, createTag } = build();
    tags.seedCustom('u1', { name: 'Garden' });
    await expect(
      createTag.execute('u1', 'free', { name: 'garden', color: '#000000' }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('UpdateTag', () => {
  it('guard order: 404 unknown → 403 default → 403 not-owner', async () => {
    const { tags, updateTag } = build();
    const foreign = tags.seedCustom('other', { name: 'Foreign' });
    await expect(updateTag.execute('u1', 'ghost', { name: 'x' })).rejects.toThrow(NotFoundError);
    await expect(updateTag.execute('u1', 'default-work', { name: 'x' })).rejects.toThrow(
      new ForbiddenError('Default tags cannot be modified.'),
    );
    await expect(updateTag.execute('u1', foreign.id, { name: 'x' })).rejects.toThrow(
      new ForbiddenError('You do not own this tag.'),
    );
  });

  it('renames/recolors an owned custom tag', async () => {
    const { tags, updateTag } = build();
    const mine = tags.seedCustom('u1', { name: 'Old', color: '#111111' });
    const updated = await updateTag.execute('u1', mine.id, { name: 'New', color: '#222222' });
    expect(updated).toMatchObject({ id: mine.id, name: 'New', color: '#222222' });
  });

  it('rename onto an existing custom name → conflict', async () => {
    const { tags, updateTag } = build();
    tags.seedCustom('u1', { name: 'Taken' });
    const mine = tags.seedCustom('u1', { name: 'Renaming' });
    await expect(updateTag.execute('u1', mine.id, { name: 'taken' })).rejects.toThrow(
      ConflictError,
    );
  });
});

describe('DeleteTag', () => {
  it('guard order: 404 unknown → 403 default → 403 not-owner; deletes owned', async () => {
    const { tags, deleteTag } = build();
    const foreign = tags.seedCustom('other', { name: 'Foreign' });
    const mine = tags.seedCustom('u1', { name: 'Mine' });
    await expect(deleteTag.execute('u1', 'ghost')).rejects.toThrow(NotFoundError);
    await expect(deleteTag.execute('u1', 'default-work')).rejects.toThrow(
      new ForbiddenError('Default tags cannot be deleted.'),
    );
    await expect(deleteTag.execute('u1', foreign.id)).rejects.toThrow(
      new ForbiddenError('You do not own this tag.'),
    );
    await deleteTag.execute('u1', mine.id);
    expect(tags.rows.has(mine.id)).toBe(false);
    expect(tags.rows.has(foreign.id)).toBe(true); // untouched
  });
});
