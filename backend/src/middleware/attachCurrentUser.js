// backend/src/middleware/attachCurrentUser.js

// Lightweight middleware that attaches user info from the JWT itself,
// without persisting to a separate users table.

function attachCurrentUser(/* db */) {
  return async function (req, res, next) {
    try {
      const sub = req.auth && req.auth.payload && req.auth.payload.sub;
      if (!sub) {
        return res.status(401).json({ message: 'Missing auth sub' });
      }

      const email =
        (req.auth && req.auth.payload && req.auth.payload.email) || null;

      req.user = {
        auth0Sub: sub,
        email,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { attachCurrentUser };
