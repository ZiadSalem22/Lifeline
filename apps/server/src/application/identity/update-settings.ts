import type { Settings, UpdateSettingsInput } from '@lifeline/shared';
import type { SettingsRepository, SettingsUpsert } from '../ports.js';
import { toSettingsDto } from './mappers.js';

export interface UpdateSettingsDeps {
  settings: SettingsRepository;
}

/** PUT /api/v1/me/settings — partial upsert (DB defaults fill missing fields). */
export class UpdateSettings {
  constructor(private readonly deps: UpdateSettingsDeps) {}

  async execute(userId: string, input: UpdateSettingsInput): Promise<Settings> {
    const upsert: SettingsUpsert = {};
    if (input.theme !== undefined) upsert.theme = input.theme;
    if (input.locale !== undefined) upsert.locale = input.locale;
    if (input.layout !== undefined) upsert.layout = input.layout;

    const saved = await this.deps.settings.upsert(userId, upsert);
    return toSettingsDto(saved);
  }
}
