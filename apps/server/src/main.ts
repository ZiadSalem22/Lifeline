import { loadEnv } from './config/env.js';
import { createLogger } from './config/logger.js';
import { buildContainer } from './container.js';
import { createApp } from './http/app.js';

/**
 * Bootstrap only: parse env → logger → container → app → listen.
 * JWKS warm-up is fire-and-forget; SIGTERM/SIGINT drain the server and close
 * the pool, with a 10s force-exit safety timer (unref'd).
 */
const env = loadEnv();
const logger = createLogger(env);
const container = buildContainer(env, logger);
const app = createApp(container);

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, authDisabled: env.AUTH_DISABLED },
    'Lifeline API listening',
  );
});

// Warm the JWKS cache so the first authenticated request is fast (non-fatal).
void container.auth.state.warmUp(logger);

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');

  const forceExit = setTimeout(() => {
    logger.error('Forced exit after 10s shutdown timeout');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(() => {
    container
      .shutdown()
      .then(() => {
        logger.info('Shutdown complete');
        process.exit(0);
      })
      .catch((error: unknown) => {
        logger.error({ err: error }, 'Error during shutdown');
        process.exit(1);
      });
  });
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
