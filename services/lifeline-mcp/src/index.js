import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = createApp({ config });

const server = app.listen(config.port, config.host, () => {
  console.log(`[lifeline-mcp] listening on http://${config.host}:${config.port}`);
});

async function shutdown(signal) {
  console.log(`[lifeline-mcp] received ${signal}; shutting down`);
  await new Promise((resolve) => {
    server.close(() => resolve());
  });
}

process.on('SIGINT', async () => {
  await shutdown('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdown('SIGTERM');
  process.exit(0);
});
