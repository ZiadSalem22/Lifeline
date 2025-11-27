#!/usr/bin/env node
const { AppDataSource } = require('../infra/db/data-source');
const process = require('process');


async function promoteAdmin(userId, { exitOnFinish = true } = {}) {
  // In test mode, always disable process.exit
  const isTest = process.env.NODE_ENV === 'test';
  if (!userId) {
    if (exitOnFinish && !isTest) {
      console.error('Usage: node src/scripts/promote-admin.js <user_id>');
      process.exit(1);
    } else {
      throw new Error('No userId provided');
    }
  }
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const repo = AppDataSource.getRepository('User');
    const user = await repo.findOne({ where: { id: userId } });
    if (!user) {
      if (exitOnFinish && !isTest) {
        console.error(`User not found: ${userId}`);
        process.exit(2);
      } else {
        throw new Error('User not found');
      }
    }
    user.role = 'admin';
    await repo.save(user);
    if (exitOnFinish && !isTest) {
      console.log(`User ${userId} promoted to admin.`);
      process.exit(0);
    }
    return user;
  } catch (err) {
    if (exitOnFinish && !isTest) {
      console.error('Error promoting user:', err.message);
      process.exit(3);
    } else {
      throw err;
    }
  }
}

if (require.main === module && process.env.NODE_ENV !== 'test') {
  promoteAdmin(process.argv[2]);
}

module.exports = { promoteAdmin };
