#!/usr/bin/env node
const process = require('process');
const shouldSuppressBootstrapLogs = process.argv.includes('--json');
const originalConsoleLog = console.log;

if (shouldSuppressBootstrapLogs) {
  console.log = () => {};
}

const { AppDataSource } = require('../infra/db/data-source');
const TypeORMMcpApiKeyRepository = require('../infrastructure/TypeORMMcpApiKeyRepository');
const TypeORMUserRepository = require('../infrastructure/TypeORMUserRepository');
const { DEFAULT_MCP_API_KEY_SCOPES, IssueMcpApiKey } = require('../application/IssueMcpApiKey');

if (shouldSuppressBootstrapLogs) {
  console.log = originalConsoleLog;
}

function printUsage() {
  console.error('Usage: node src/scripts/issue-mcp-api-key.js --user-id <userId> [--email <email>] --name <keyName> [--scopes tasks:read,tasks:write] [--expires-at <iso>] [--create-user-if-missing] [--user-name <displayName>] [--json]');
}

function parseArguments(argv) {
  const options = {
    json: false,
    createUserIfMissing: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--json') {
      options.json = true;
      continue;
    }

    if (token === '--create-user-if-missing') {
      options.createUserIfMissing = true;
      continue;
    }

    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (typeof value === 'undefined' || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    options[key] = value;
    index += 1;
  }

  return options;
}

function normalizeEmail(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || null;
}

async function resolveUser(options) {
  const requestedUserId = String(options['user-id'] || '').trim();
  const requestedEmail = normalizeEmail(options.email);

  let user = null;

  if (requestedUserId) {
    user = await TypeORMUserRepository.findById(requestedUserId);
  }

  if (!user && requestedEmail) {
    user = await TypeORMUserRepository.findByEmail(requestedEmail);
  }

  if (user) {
    if (requestedUserId && user.id !== requestedUserId) {
      throw new Error(`Resolved user ${user.id} does not match requested --user-id ${requestedUserId}`);
    }

    if (requestedEmail && user.email && String(user.email).trim().toLowerCase() !== requestedEmail) {
      throw new Error(`Resolved user email ${user.email} does not match requested --email ${requestedEmail}`);
    }

    return { user, created: false };
  }

  if (!options.createUserIfMissing) {
    throw new Error('User not found. Pass an existing --user-id or --email, or use --create-user-if-missing with --user-id for local/dev validation.');
  }

  if (!requestedUserId) {
    throw new Error('--create-user-if-missing requires --user-id.');
  }

  const createdUser = await TypeORMUserRepository.ensureUserFromAuth0Claims({
    sub: requestedUserId,
    email: requestedEmail,
    name: String(options['user-name'] || requestedUserId).trim() || requestedUserId,
  });

  return { user: createdUser, created: true };
}

async function main(argv = process.argv.slice(2), { exitOnFinish = true } = {}) {
  const isTest = process.env.NODE_ENV === 'test';

  try {
    const options = parseArguments(argv);
    const keyName = String(options.name || '').trim();

    if (!keyName) {
      throw new Error('--name is required.');
    }

    if (!options['user-id'] && !options.email) {
      throw new Error('Provide --user-id or --email to select the Lifeline user.');
    }

    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const { user, created } = await resolveUser(options);
    const issuer = new IssueMcpApiKey({
      mcpApiKeyRepository: TypeORMMcpApiKeyRepository,
      userRepository: TypeORMUserRepository,
    });

    const issued = await issuer.execute({
      userId: user.id,
      name: keyName,
      scopes: options.scopes || DEFAULT_MCP_API_KEY_SCOPES,
      expiresAt: options['expires-at'] || null,
    });

    const payload = {
      ...issued,
      userCreated: created,
    };

    if (options.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log(`Issued MCP API key for user ${payload.userId}${payload.userEmail ? ` (${payload.userEmail})` : ''}`);
      console.log(`Key name: ${payload.name}`);
      console.log(`Scopes: ${payload.scopes.join(', ')}`);
      console.log(`Key prefix: ${payload.keyPrefix}`);
      console.log(`Created user record: ${payload.userCreated ? 'yes' : 'no'}`);
      if (payload.expiresAt) {
        console.log(`Expires at: ${payload.expiresAt}`);
      }
      console.log('Plaintext key (shown once):');
      console.log(payload.apiKey);
    }

    return payload;
  } catch (error) {
    if (exitOnFinish && !isTest) {
      printUsage();
      console.error(error.message);
      process.exit(1);
    }

    throw error;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

if (require.main === module && process.env.NODE_ENV !== 'test') {
  main();
}

module.exports = {
  main,
  parseArguments,
};
