// backend/src/middleware/attachCurrentUser.js

// Middleware that upserts the user into MSSQL via TypeORM and
// attaches the current user record to req.currentUser.

const userRepo = require('../infrastructure/TypeORMUserRepository');
const userProfileRepo = require('../infrastructure/TypeORMUserProfileRepository');
const userSettingsRepo = require('../infrastructure/TypeORMUserSettingsRepository');
const logger = require('../config/logger');


async function attachCurrentUser(req, res, next) {
  try {
    // Dev bypass: when AUTH_DISABLED=1, attach a deterministic local guest user
    if (process.env.AUTH_DISABLED === '1') {
      req.currentUser = {
        id: 'guest-local',
        email: null,
        name: 'Local Guest',
        role: 'free',
        roles: ['free'],
        subscription_status: null,
        profile: { onboarding_completed: false },
        settings: null,
      };
      return next();
    }
    // Hardened guest mode: if no Authorization header, do NOT create a surrogate user
    // and perform absolutely no DB interaction. Controllers behind requireAuth will
    // emit a 401 with a friendly message.
    if (!req.headers.authorization) {
      req.currentUser = null;
      return next();
    }
    const claims = req.auth?.payload || {};
    const sub = claims.sub;
    const email = claims.email;
    if (!sub) {
      req.currentUser = null;
      return next();
    }
    // Auth0 roles as source of truth
    const customClaims = claims || {};
    const roles = customClaims["https://lifeline-api/roles"] || [];
    // First valid role or 'free'
    let role = 'free';
    if (Array.isArray(roles)) {
      if (roles.includes('admin')) role = 'admin';
      else if (roles.includes('paid')) role = 'paid';
      else if (roles.includes('free')) role = 'free';
    }
    let user = await userRepo.ensureUserFromAuth0Claims(claims);
    if (!user) {
      req.currentUser = { id: sub, email: email || null, roles, role };
      return next();
    }
    // Load profile
    let profile = null;
    try {
      profile = await userProfileRepo.findByUserId(user.id);
    } catch (e) {
      logger.warn('[attachCurrentUser] failed to load user profile', { userId: user.id, error: e.message });
    }

    // Load user settings if available
    let settings = null;
    try {
      settings = await userSettingsRepo.findByUserId(user.id);
    } catch (e) {
      logger.warn('[attachCurrentUser] failed to load user settings', { userId: user.id, error: e.message });
    }

    req.currentUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role,
      roles,
      subscription_status: user.subscription_status,
      profile: profile
        ? {
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone: profile.phone,
            country: profile.country,
            timezone: profile.timezone,
            onboarding_completed: !!profile.onboarding_completed
          }
        : { onboarding_completed: false }
      ,
      settings: settings || null
    };
    return next();
  } catch (err) {
    logger.error('[attachCurrentUser] upsert or profile load failed', { error: err.message });
    req.currentUser = { id: req.auth?.payload?.sub, email: req.auth?.payload?.email || null };
    return next();
  }
}

module.exports = { attachCurrentUser };
