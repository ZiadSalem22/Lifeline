const path = require('path');
const dotenv = require('dotenv');

const envFile = process.env.NODE_ENV === 'development' ? '.env.local' : '.env';
dotenv.config({ path: path.join(__dirname, '..', '..', '..', envFile) });

const entities = [
  require('./entities/TodoEntity'),
  require('./entities/TagEntity'),
  require('./entities/TodoTagEntity'),
  require('./entities/McpApiKeyEntity'),
  require('./entities/UserEntity'),
  require('./entities/UserProfileEntity'),
  require('./entities/UserSettingsEntity'),
];

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function getSslOptions() {
  if (!parseBoolean(process.env.PGSSL, false)) {
    return false;
  }

  return {
    rejectUnauthorized: !parseBoolean(process.env.PGSSL_ALLOW_SELF_SIGNED, true),
  };
}

function getConnectionOptions() {
  const common = {
    type: 'postgres',
    synchronize: false,
    logging: parseBoolean(process.env.TYPEORM_LOGGING, process.env.NODE_ENV !== 'test'),
    entities,
    ssl: getSslOptions(),
  };

  if (process.env.DATABASE_URL) {
    return {
      ...common,
      url: process.env.DATABASE_URL,
    };
  }

  return {
    ...common,
    host: process.env.PGHOST || process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.PGPORT || process.env.POSTGRES_PORT || 5432),
    username: process.env.PGUSER || process.env.POSTGRES_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '',
    database: process.env.PGDATABASE || process.env.POSTGRES_DATABASE || 'lifeline',
  };
}

function buildAppDataSourceOptions({ includeMigrations = false } = {}) {
  const options = getConnectionOptions();
  if (includeMigrations) {
    options.migrations = [path.join(__dirname, '..', '..', 'migrations', '*.js')];
  }
  return options;
}

function buildPgClientConfig() {
  const options = getConnectionOptions();

  if (options.url) {
    return {
      connectionString: options.url,
      ssl: options.ssl,
    };
  }

  return {
    host: options.host,
    port: options.port,
    user: options.username,
    password: options.password,
    database: options.database,
    ssl: options.ssl,
  };
}

module.exports = {
  buildAppDataSourceOptions,
  buildPgClientConfig,
  parseBoolean,
};
