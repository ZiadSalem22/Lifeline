const { AppError } = require('../utils/errors');


// Enhanced requireAuth: allow guest mode for todos/tags/me, block admin/paid
function requireAuth() {
  // Hardened: no guest allowances. Missing or null user yields 401 with friendly message.
  return function (req, res, next) {
    if (!req.currentUser || !req.currentUser.id) {
      return next(new AppError('Please log in to use this feature. Guest mode works only locally.', 401));
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
