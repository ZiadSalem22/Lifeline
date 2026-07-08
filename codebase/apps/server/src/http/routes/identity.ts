import { Router } from 'express';
import {
  meSchema,
  problemSchema,
  profileSchema,
  settingsSchema,
  updateProfileSchema,
  updateSettingsSchema,
  type UpdateProfileInput,
  type UpdateSettingsInput,
} from '@lifeline/shared';
import { UnauthorizedError } from '../../domain/errors.js';
import type { GetMe } from '../../application/identity/get-me.js';
import type { UpdateProfile } from '../../application/identity/update-profile.js';
import type { UpdateSettings } from '../../application/identity/update-settings.js';
import { getValidated, validate } from '../middleware/validate.js';
import type { OpenApiRegistry } from '../openapi/registry.js';

export interface IdentityDeps {
  getMe: GetMe;
  updateProfile: UpdateProfile;
  updateSettings: UpdateSettings;
  registry: OpenApiRegistry;
}

/**
 * Identity slice: GET /me, PUT /me/profile, PUT /me/settings.
 * Mounted inside the authenticated /api/v1 router.
 */
export function createIdentityRouter(deps: IdentityDeps): Router {
  const router = Router();

  deps.registry.register({
    method: 'get',
    path: '/api/v1/me',
    summary: 'Current user identity (profile null → client routes to onboarding)',
    tag: 'identity',
    responses: {
      '200': { description: 'Current user', schema: meSchema },
      '401': { description: 'Not authenticated', schema: problemSchema },
    },
  });
  router.get('/me', async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const me = await deps.getMe.execute(user.id, user.roles);
    res.json(me);
  });

  deps.registry.register({
    method: 'put',
    path: '/api/v1/me/profile',
    summary: 'Replace profile (onboardingCompleted is one-way; email conflicts → 409)',
    tag: 'identity',
    request: { body: updateProfileSchema },
    responses: {
      '200': { description: 'Updated profile', schema: profileSchema },
      '400': { description: 'Validation failed', schema: problemSchema },
      '409': { description: 'Email already in use', schema: problemSchema },
    },
  });
  router.put('/me/profile', validate(updateProfileSchema), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const input = getValidated<UpdateProfileInput>(req);
    const profile = await deps.updateProfile.execute(user.id, input);
    res.json(profile);
  });

  deps.registry.register({
    method: 'put',
    path: '/api/v1/me/settings',
    summary: 'Upsert settings (partial)',
    tag: 'identity',
    request: { body: updateSettingsSchema },
    responses: {
      '200': { description: 'Updated settings', schema: settingsSchema },
      '400': { description: 'Validation failed', schema: problemSchema },
    },
  });
  router.put('/me/settings', validate(updateSettingsSchema), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const input = getValidated<UpdateSettingsInput>(req);
    const settings = await deps.updateSettings.execute(user.id, input);
    res.json(settings);
  });

  return router;
}

function requireCurrentUser<T extends { id: string }>(user: T | null | undefined): T {
  if (!user?.id) throw new UnauthorizedError();
  return user;
}
