import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = process.cwd();
const src = path.join(root, 'staticwebapp.config.json');
const destDir = path.join(root, 'dist');
const dest = path.join(destDir, 'staticwebapp.config.json');

try {
  if (!fs.existsSync(src)) {
    console.log('copy-swa-config: no staticwebapp.config.json found at project root; skipping');
    process.exit(0);
  }
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log('copy-swa-config: copied staticwebapp.config.json to dist');
} catch (err) {
  console.error('copy-swa-config: failed to copy config', err.message);
  process.exit(1);
}