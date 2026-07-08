import { pino, type Logger as PinoLogger } from 'pino';
import type { Env } from './env.js';

export type Logger = PinoLogger;

export function createLogger(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): Logger {
  return pino({
    level: env.LOG_LEVEL,
    // Pretty logs are a dev convenience only; production stays structured JSON.
    ...(env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true, singleLine: true } } }
      : {}),
    redact: {
      paths: ['req.headers.authorization', 'req.headers["x-api-key"]'],
      censor: '[redacted]',
    },
  });
}
