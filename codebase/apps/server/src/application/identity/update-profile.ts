import { DAY_NAMES, type Profile, type UpdateProfileInput } from '@lifeline/shared';
import { DomainValidationError, NotFoundError } from '../../domain/errors.js';
import type { ProfileRepository, ProfileUpsert, UserRepository } from '../ports.js';
import { toProfileDto } from './mappers.js';

export interface UpdateProfileDeps {
  users: UserRepository;
  profiles: ProfileRepository;
}

/**
 * PUT /api/v1/me/profile. firstName/lastName required (schema-enforced);
 * email uniqueness → 409; `onboardingCompleted` is one-way (never reverts);
 * `startDayOfWeek` whitelisted to full English day names.
 */
export class UpdateProfile {
  constructor(private readonly deps: UpdateProfileDeps) {}

  async execute(userId: string, input: UpdateProfileInput): Promise<Profile> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    if (
      input.startDayOfWeek !== undefined &&
      !(DAY_NAMES as readonly string[]).includes(input.startDayOfWeek)
    ) {
      // zod already enforces the enum; this guards non-HTTP callers (MCP, scripts).
      throw new DomainValidationError('startDayOfWeek must be a full English day name', {
        startDayOfWeek: [`Expected one of: ${DAY_NAMES.join(', ')}`],
      });
    }

    if (input.email !== undefined) {
      const nextEmail = input.email.toLowerCase();
      if (nextEmail !== (user.email ?? '').toLowerCase()) {
        // Repo throws ConflictError('Email already in use by another account').
        await this.deps.users.updateEmail(userId, nextEmail);
      }
    }

    const existing = await this.deps.profiles.get(userId);
    const upsert: ProfileUpsert = {
      firstName: input.firstName,
      lastName: input.lastName,
      // One-way: once completed it stays completed regardless of the input.
      onboardingCompleted:
        existing?.onboardingCompleted === true || input.onboardingCompleted === true,
    };
    if (input.phone !== undefined) upsert.phone = input.phone;
    if (input.country !== undefined) upsert.country = input.country;
    if (input.city !== undefined) upsert.city = input.city;
    if (input.timezone !== undefined) upsert.timezone = input.timezone;
    if (input.avatarUrl !== undefined) upsert.avatarUrl = input.avatarUrl;
    if (input.startDayOfWeek !== undefined) upsert.startDayOfWeek = input.startDayOfWeek;

    const saved = await this.deps.profiles.upsert(userId, upsert);
    return toProfileDto(saved);
  }
}
