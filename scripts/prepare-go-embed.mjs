import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');
const source = path.join(root, 'dist');
const target = path.join(root, 'cmd', 'sonic-topography', 'dist');

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyDirectory(from, to) {
  await fs.mkdir(to, { recursive: true });
  const entries = await fs.readdir(from, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(from, entry.name);
    const targetPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

if (!(await pathExists(path.join(source, 'index.html')))) {
  throw new Error('dist/index.html not found. Run npm run build first.');
}

await copyDirectory(source, target);
console.log(`Copied ${source} -> ${target}`);
