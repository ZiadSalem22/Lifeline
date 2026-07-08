import { ConflictError } from '../../src/domain/errors.js';
import { pickPrimaryRole } from '../../src/application/identity/claims.js';
import type {
  AuthClaims,
  EnsureFromClaimsOptions,
  ProfileRecord,
  ProfileRepository,
  ProfileUpsert,
  SettingsRecord,
  SettingsRepository,
  SettingsUpsert,
  UserRecord,
  UserRepository,
} from '../../src/application/ports.js';

/** In-memory repository fakes — NO real database in unit tests. */

export class InMemoryUserRepository implements UserRepository {
  readonly rows = new Map<string, UserRecord>();
  readonly ensureCalls: AuthClaims[] = [];

  seed(row: Partial<UserRecord> & { id: string }): UserRecord {
    const full: UserRecord = {
      auth0Sub: row.id,
      email: null,
      name: null,
      picture: null,
      role: 'free',
      subscriptionStatus: 'none',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...row,
    };
    this.rows.set(full.id, full);
    return full;
  }

  ensureFromClaims(claims: AuthClaims, options?: EnsureFromClaimsOptions): Promise<UserRecord> {
    this.ensureCalls.push(claims);
    const syncRoleOnlyWhenPresent = options?.syncRoleOnlyWhenPresent ?? true;
    const existing = this.rows.get(claims.sub);
    const claimRole = pickPrimaryRole(claims.roles);
    if (!existing) {
      return Promise.resolve(
        this.seed({
          id: claims.sub,
          auth0Sub: claims.sub,
          email: claims.email,
          name: claims.name,
          picture: claims.picture,
          role: claimRole,
        }),
      );
    }
    const next: UserRecord = {
      ...existing,
      email: claims.email,
      name: claims.name,
      picture: claims.picture,
      updatedAt: new Date(),
      role: claims.hasRoleClaims || !syncRoleOnlyWhenPresent ? claimRole : existing.role,
    };
    this.rows.set(next.id, next);
    return Promise.resolve(next);
  }

  findById(id: string): Promise<UserRecord | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  updateEmail(userId: string, email: string): Promise<void> {
    const lowered = email.toLowerCase();
    for (const [id, row] of this.rows) {
      if (id !== userId && row.email?.toLowerCase() === lowered) {
        return Promise.reject(new ConflictError('Email already in use by another account'));
      }
    }
    const row = this.rows.get(userId);
    if (row) this.rows.set(userId, { ...row, email: lowered, updatedAt: new Date() });
    return Promise.resolve();
  }
}

export class InMemoryProfileRepository implements ProfileRepository {
  readonly rows = new Map<string, ProfileRecord>();

  get(userId: string): Promise<ProfileRecord | null> {
    return Promise.resolve(this.rows.get(userId) ?? null);
  }

  upsert(userId: string, data: ProfileUpsert): Promise<ProfileRecord> {
    const existing = this.rows.get(userId);
    const base: ProfileRecord = existing ?? {
      userId,
      firstName: null,
      lastName: null,
      phone: null,
      country: null,
      city: null,
      timezone: null,
      avatarUrl: null,
      onboardingCompleted: false,
      startDayOfWeek: 'Monday',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const next: ProfileRecord = { ...base, updatedAt: new Date() };
    if (data.firstName !== undefined) next.firstName = data.firstName;
    if (data.lastName !== undefined) next.lastName = data.lastName;
    if (data.phone !== undefined) next.phone = data.phone;
    if (data.country !== undefined) next.country = data.country;
    if (data.city !== undefined) next.city = data.city;
    if (data.timezone !== undefined) next.timezone = data.timezone;
    if (data.avatarUrl !== undefined) next.avatarUrl = data.avatarUrl;
    if (data.startDayOfWeek !== undefined) next.startDayOfWeek = data.startDayOfWeek;
    if (data.onboardingCompleted !== undefined) {
      next.onboardingCompleted = data.onboardingCompleted;
    }
    this.rows.set(userId, next);
    return Promise.resolve(next);
  }
}

export class InMemorySettingsRepository implements SettingsRepository {
  readonly rows = new Map<string, SettingsRecord>();

  get(userId: string): Promise<SettingsRecord | null> {
    return Promise.resolve(this.rows.get(userId) ?? null);
  }

  upsert(userId: string, data: SettingsUpsert): Promise<SettingsRecord> {
    const existing = this.rows.get(userId);
    const base: SettingsRecord = existing ?? {
      userId,
      theme: 'system',
      locale: 'en',
      layout: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const next: SettingsRecord = { ...base, updatedAt: new Date() };
    if (data.theme !== undefined) next.theme = data.theme;
    if (data.locale !== undefined) next.locale = data.locale;
    if (data.layout !== undefined) next.layout = data.layout;
    this.rows.set(userId, next);
    return Promise.resolve(next);
  }

  deleteByUser(userId: string): Promise<void> {
    this.rows.delete(userId);
    return Promise.resolve();
  }
}
