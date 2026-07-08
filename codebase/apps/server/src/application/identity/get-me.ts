import type { Me } from '@lifeline/shared';
import { NotFoundError } from '../../domain/errors.js';
import type { ProfileRepository, SettingsRepository, UserRepository } from '../ports.js';
import { toProfileDto, toSettingsDto } from './mappers.js';

export interface GetMeDeps {
  users: UserRepository;
  profiles: ProfileRepository;
  settings: SettingsRepository;
}

/** Assemble the `GET /api/v1/me` DTO from user + profile + settings rows. */
export class GetMe {
  constructor(private readonly deps: GetMeDeps) {}

  /**
   * @param tokenRoles roles carried by the verified token (may be empty);
   *   the DTO falls back to `[dbRole]` so DB-promoted admins stay visible.
   */
  async execute(userId: string, tokenRoles: readonly string[] = []): Promise<Me> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const [profile, settings] = await Promise.all([
      this.deps.profiles.get(userId),
      this.deps.settings.get(userId),
    ]);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role,
      roles: tokenRoles.length > 0 ? [...new Set(tokenRoles)] : [user.role],
      subscriptionStatus: user.subscriptionStatus,
      profile: profile ? toProfileDto(profile) : null,
      settings: settings ? toSettingsDto(settings) : null,
    };
  }
}
