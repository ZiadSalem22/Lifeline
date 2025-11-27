// backend/src/middleware/attachCurrentUser.js

// Middleware that upserts the user into MSSQL via TypeORM and
// attaches the current user record to req.currentUser.
const TypeORMUserRepository = require('../infrastructure/TypeORMUserRepository');

function attachCurrentUser() {
  const userRepo = new TypeORMUserRepository();
  return async function (req, res, next) {
    try {
      const payload = req.auth?.payload || {};
      const sub = payload.sub;
      const email = payload.email;
      const name = payload.name;
      const picture = payload.picture;

      if (!sub) {
        req.currentUser = null;
        return next();
      }

      const user = await userRepo.saveOrUpdateFromAuth0({ sub, email, name, picture });
      req.currentUser = user || { id: sub, email, name, picture };
      return next();
    } catch (err) {
      req.currentUser = null;
      return next();
    }
  };
}

module.exports = { attachCurrentUser };
