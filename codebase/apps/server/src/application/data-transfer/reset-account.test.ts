import { describe, expect, it } from 'vitest';
import {
  InMemoryMcpKeyRepository,
  InMemoryTagRepository,
  InMemoryTodoRepository,
} from '../../../test/helpers/feature-fakes.js';
import {
  InMemoryProfileRepository,
  InMemorySettingsRepository,
  InMemoryUserRepository,
} from '../../../test/helpers/in-memory.js';
import { ResetAccount } from './reset-account.js';

describe('ResetAccount', () => {
  it('deletes todos + custom tags + settings; keeps user, profile, and MCP keys', async () => {
    const users = new InMemoryUserRepository();
    const profiles = new InMemoryProfileRepository();
    const settings = new InMemorySettingsRepository();
    const tags = new InMemoryTagRepository();
    tags.seedDefaults();
    const todos = new InMemoryTodoRepository(tags);
    const keys = new InMemoryMcpKeyRepository();

    users.seed({ id: 'u1', email: 'u1@example.com' });
    await profiles.upsert('u1', { firstName: 'Ada', lastName: 'Lovelace' });
    await settings.upsert('u1', { theme: 'dark' });
    todos.seed('u1');
    todos.seed('u1', { archived: true });
    tags.seedCustom('u1', { name: 'Mine' });
    const key = keys.seed({ userId: 'u1' });

    // Another user's data must be untouched.
    todos.seed('u2');
    tags.seedCustom('u2', { name: 'Theirs' });
    await settings.upsert('u2', { theme: 'light' });

    await new ResetAccount({ todos, tags, settings }).execute('u1');

    expect(todos.rowsFor('u1')).toHaveLength(0);
    expect(await tags.countCustomByUser('u1')).toBe(0);
    expect(await settings.get('u1')).toBeNull();
    // Kept: user row, profile, keys, and global defaults.
    expect(await users.findById('u1')).not.toBeNull();
    expect(await profiles.get('u1')).not.toBeNull();
    expect(await keys.findById('u1', key.id)).not.toBeNull();
    expect((await tags.listVisible('u1')).filter((tag) => tag.isDefault)).toHaveLength(10);
    // Other users untouched.
    expect(todos.rowsFor('u2')).toHaveLength(1);
    expect(await tags.countCustomByUser('u2')).toBe(1);
    expect(await settings.get('u2')).not.toBeNull();
  });
});
