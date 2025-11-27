// backend/src/middleware/attachCurrentUser.js

// Middleware that upserts the user into MSSQL via TypeORM and
// attaches the current user record to req.currentUser.

const userRepo = require('../infrastructure/TypeORMUserRepository');
const userProfileRepo = require('../infrastructure/TypeORMUserProfileRepository');
const logger = require('../config/logger');


async function attachCurrentUser(req, res, next) {
  try {
    const claims = req.auth?.payload || {};
    const sub = claims.sub;
    const email = claims.email;
    if (!sub) {
      req.currentUser = null;
      return next();
    }
    // Upsert user and map roles
    let user = await userRepo.ensureUserFromAuth0Claims(claims);
    if (!user) {
      req.currentUser = { id: sub, email: email || null };
      return next();
    }
    // Load profile
    let profile = null;
    try {
      profile = await userProfileRepo.findByUserId(user.id);
    } catch (e) {
      logger.warn('[attachCurrentUser] failed to load user profile', { userId: user.id, error: e.message });
    }
    req.currentUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role,
      subscription_status: user.subscription_status,
      profile: profile
        ? {
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone: profile.phone,
            country: profile.country,
            city: profile.city,
            timezone: profile.timezone,
            avatar_url: profile.avatar_url,
            onboarding_completed: profile.onboarding_completed
          }
        : null
    };
    return next();
  } catch (err) {
    logger.error('[attachCurrentUser] upsert or profile load failed', { error: err.message });
    req.currentUser = { id: req.auth?.payload?.sub, email: req.auth?.payload?.email || null };
    return next();
  }
}

module.exports = { attachCurrentUser };
