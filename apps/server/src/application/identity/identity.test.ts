import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../../domain/errors.js';
import {
  InMemoryProfileRepository,
  InMemorySettingsRepository,
  InMemoryUserRepository,
} from '../../../test/helpers/in-memory.js';
import { GetMe } from './get-me.js';
import { UpdateProfile } from './update-profile.js';
import { UpdateSettings } from './update-settings.js';

function buildDeps() {
  const users = new InMemoryUserRepository();
  const profiles = new InMemoryProfileRepository();
  const settings = new InMemorySettingsRepository();
  return { users, profiles, settings };
}

describe('GetMe', () => {
  it('assembles the Me DTO with null profile/settings when absent', async () => {
    const deps = buildDeps();
    deps.users.seed({ id: 'u1', email: 'u1@example.com', role: 'free' });
    const me = await new GetMe(deps).execute('u1');
    expect(me).toMatchObject({
      id: 'u1',
      email: 'u1@example.com',
      role: 'free',
      roles: ['free'],
      profile: null,
      settings: null,
    });
  });

  it('maps profile/settings rows to camelCase DTOs', async () => {
    const deps = buildDeps();
    deps.users.seed({ id: 'u1' });
    await deps.profiles.upsert('u1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      startDayOfWeek: 'Sunday',
      onboardingCompleted: true,
    });
    await deps.settings.upsert('u1', { theme: 'dark', layout: { sidebar: 'compact' } });
    const me = await new GetMe(deps).execute('u1', ['paid']);
    expect(me.profile).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      startDayOfWeek: 'Sunday',
      onboardingCompleted: true,
    });
    expect(me.settings).toMatchObject({
      theme: 'dark',
      locale: 'en',
      layout: { sidebar: 'compact' },
    });
    expect(me.roles).toEqual(['paid']);
  });

  it('throws NotFoundError for unknown users', async () => {
    await expect(new GetMe(buildDeps()).execute('ghost')).rejects.toThrow(NotFoundError);
  });
});

describe('UpdateProfile', () => {
  it('creates the profile and returns the DTO', async () => {
    const deps = buildDeps();
    deps.users.seed({ id: 'u1' });
    const profile = await new UpdateProfile(deps).execute('u1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      startDayOfWeek: 'Saturday',
    });
    expect(profile).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      startDayOfWeek: 'Saturday',
      onboardingCompleted: false,
    });
  });

  it('onboardingCompleted is one-way', async () => {
    const deps = buildDeps();
    deps.users.seed({ id: 'u1' });
    const useCase = new UpdateProfile(deps);
    await useCase.execute('u1', { firstName: 'A', lastName: 'B', onboardingCompleted: true });
    const after = await useCase.execute('u1', {
      firstName: 'A',
      lastName: 'B',
      onboardingCompleted: false,
    });
    expect(after.onboardingCompleted).toBe(true);
    const untouched = await useCase.execute('u1', { firstName: 'A', lastName: 'B' });
    expect(untouched.onboardingCompleted).toBe(true);
  });

  it('rejects an email already used by another account with 409', async () => {
    const deps = buildDeps();
    deps.users.seed({ id: 'u1', email: 'mine@example.com' });
    deps.users.seed({ id: 'u2', email: 'taken@example.com' });
    await expect(
      new UpdateProfile(deps).execute('u1', {
        firstName: 'A',
        lastName: 'B',
        email: 'Taken@Example.com',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('allows keeping your own email (case-insensitive no-op)', async () => {
    const deps = buildDeps();
    deps.users.seed({ id: 'u1', email: 'mine@example.com' });
    await expect(
      new UpdateProfile(deps).execute('u1', {
        firstName: 'A',
        lastName: 'B',
        email: 'MINE@example.com',
      }),
    ).resolves.toBeDefined();
  });

  it('throws NotFoundError for unknown users', async () => {
    await expect(
      new UpdateProfile(buildDeps()).execute('ghost', { firstName: 'A', lastName: 'B' }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('UpdateSettings', () => {
  it('upserts partially, leaving other fields at defaults', async () => {
    const deps = buildDeps();
    const result = await new UpdateSettings({ settings: deps.settings }).execute('u1', {
      theme: 'dark',
    });
    expect(result).toEqual({ theme: 'dark', locale: 'en', layout: {} });
    const second = await new UpdateSettings({ settings: deps.settings }).execute('u1', {
      locale: 'ar',
    });
    expect(second).toEqual({ theme: 'dark', locale: 'ar', layout: {} });
  });
});
