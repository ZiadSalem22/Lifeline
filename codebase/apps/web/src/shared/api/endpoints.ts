import type {
  Me,
  Profile,
  Settings,
  UpdateProfileInput,
  UpdateSettingsInput,
} from '@lifeline/shared';
import { api } from './client';

/**
 * Typed endpoint functions for the `/api/v1` surface used by the app
 * foundation. Later feature slices follow the same pattern in their own
 * modules (e.g. `src/features/todos/api.ts` wrapping `/todos`), always
 * importing request/response types from '@lifeline/shared'.
 */

export function getMe(): Promise<Me> {
  return api.get<Me>('/me');
}

export function putProfile(input: UpdateProfileInput): Promise<Profile> {
  return api.put<Profile>('/me/profile', input);
}

export function putSettings(input: UpdateSettingsInput): Promise<Settings> {
  return api.put<Settings>('/me/settings', input);
}
