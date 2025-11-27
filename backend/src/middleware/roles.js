const { AppError } = require('../utils/errors');


// Enhanced requireAuth: allow guest mode for todos/tags/me, block admin/paid
function requireAuth(options = {}) {
  // options: { allowGuest: boolean, guestModeResponse: boolean }
  return function (req, res, next) {
    const isGuest = req.currentUser && req.currentUser.isGuest;
    // Allow guest for certain routes
    if (isGuest && options.allowGuest) {
      if (options.guestModeResponse) {
        return res.json({ mode: 'guest' });
      }
      return next();
    }
    if (!req.currentUser || !req.currentUser.id) {
      return next(new AppError('Forbidden', 403));
    }
    next();
  };
}

function requireRole(role) {
  return function (req, res, next) {
    if (!req.currentUser || !Array.isArray(req.currentUser.roles) || !req.currentUser.roles.includes(role)) {
      return next(new AppError('Forbidden', 403));
    }
    next();
  };
}

function requireRoleIn(rolesArray) {
  return function (req, res, next) {
    if (!req.currentUser || !Array.isArray(req.currentUser.roles) || !rolesArray.some(r => req.currentUser.roles.includes(r))) {
      return next(new AppError('Forbidden', 403));
    }
    next();
  };
}

function requirePaid() {
  return function (req, res, next) {
    if (!req.currentUser || !Array.isArray(req.currentUser.roles) || !(req.currentUser.roles.includes('paid') || req.currentUser.roles.includes('admin'))) {
      return next(new AppError('Forbidden', 403));
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
  requireRoleIn,
  requirePaid,
};
