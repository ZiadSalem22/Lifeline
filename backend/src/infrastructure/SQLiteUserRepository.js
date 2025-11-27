// backend/src/infrastructure/SQLiteUserRepository.js

const User = require('../domain/User');
const { v4: uuidv4 } = require('uuid');

class SQLiteUserRepository {
  constructor(db) {
    this.db = db;
  }

  findByAuth0Sub(auth0Sub) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE auth0_sub = ?',
        [auth0Sub],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return resolve(null);
          resolve(
            new User(row.id, row.auth0_sub, row.email, row.created_at, row.updated_at)
          );
        }
      );
    });
  }

  createUser({ auth0Sub, email }) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      this.db.run(
        'INSERT INTO users (id, auth0_sub, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [id, auth0Sub, email, now, now],
        (err) => {
          if (err) return reject(err);
          resolve(new User(id, auth0Sub, email, now, now));
        }
      );
    });
  }
}

module.exports = SQLiteUserRepository;
