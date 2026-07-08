import type { Profile, Settings } from '@lifeline/shared';
import type { ProfileRecord, SettingsRecord } from '../ports.js';

/** DB records (camelCase Drizzle rows) → public API DTOs. */

export function toProfileDto(record: ProfileRecord): Profile {
  return {
    firstName: record.firstName ?? '',
    lastName: record.lastName ?? '',
    phone: record.phone,
    country: record.country,
    city: record.city,
    timezone: record.timezone,
    avatarUrl: record.avatarUrl,
    startDayOfWeek: record.startDayOfWeek,
    onboardingCompleted: record.onboardingCompleted,
  };
}

export function toSettingsDto(record: SettingsRecord): Settings {
  return {
    theme: record.theme,
    locale: record.locale,
    layout: record.layout,
  };
}
