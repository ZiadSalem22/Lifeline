// backend/src/domain/User.js

class User {
  constructor(id, auth0Sub, email, createdAt, updatedAt) {
    this.id = id;
    this.auth0Sub = auth0Sub;
    this.email = email;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = User;
