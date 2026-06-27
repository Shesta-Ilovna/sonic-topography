import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const downloadJobs = new Map();

function normalizeVersion(value) {
  return String(value || '').trim().replace(/^v/i, '');
}

function compareVersions(a, b) {
  const left = normalizeVersion(a).split('.').map((part) => Number(part) || 0);
  const right = normalizeVersion(b).split('.').map((part) => Number(part) || 0);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function normalizeUpdateSource(value) {
  const input = value && typeof value === 'object' ? value : {};
  let owner = String(input.owner || '').trim();
  let repo = String(input.repo || '').trim();
  if (owner.includes('/') && !repo) {
    const [nextOwner, nextRepo] = owner.split('/');
    owner = nextOwner || '';
    repo = nextRepo || '';
  }
  return {
    configured: Boolean(owner && repo),
    provider: 'github',
    owner,
    repo,
  };
}

async function readPackageJson() {
  const raw = await fs.readFile(path.join(appRoot, 'package.json'), 'utf8');
  return JSON.parse(raw);
}

async function getUpdateConfig() {
  const pkg = await readPackageJson();
  const envRepo = String(process.env.SONIC_UPDATE_REPO || '').trim();
  const source = envRepo
    ? normalizeUpdateSource({ owner: envRepo })
    : normalizeUpdateSource(pkg.sonicTopography?.update);
  return {
    ...source,
    currentVersion: normalizeVersion(pkg.version || '0.0.0'),
  };
}

function pickInstallerAsset(assets, latestVersion) {
  const candidates = (Array.isArray(assets) ? assets : []).filter((asset) => {
    const name = String(asset?.name || '');
    return /\.exe$/i.test(name);
  });
  return candidates.find((asset) => /setup|installer/i.test(asset.name || ''))
    || candidates.find((asset) => String(asset?.name || '').includes(latestVersion))
    || candidates[0]
    || null;
}

function safeFileName(name) {
  return String(name || 'SonicTopography-Update.exe').replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');
}

async function getLatestUpdate() {
  const config = await getUpdateConfig();
  if (!config.configured) {
    return {
      configured: false,
      updateAvailable: false,
      currentVersion: config.currentVersion,
      latestVersion: config.currentVersion,
      message: '更新源未配置',
    };
  }

  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/releases/latest`;
  const response = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'SonicTopographyUpdater',
    },
  });
  if (!response.ok) throw new Error(`GitHub latest release failed: ${response.status}`);
  const release = await response.json();
  const latestVersion = normalizeVersion(release.tag_name || release.name || config.currentVersion);
  const asset = pickInstallerAsset(release.assets, latestVersion);
  const updateAvailable = compareVersions(latestVersion, config.currentVersion) > 0;

  return {
    configured: true,
    provider: 'github',
    owner: config.owner,
    repo: config.repo,
    currentVersion: config.currentVersion,
    latestVersion,
    updateAvailable,
    release: {
      tagName: release.tag_name || `v${latestVersion}`,
      name: release.name || `Sonic Topography v${latestVersion}`,
      htmlUrl: release.html_url || '',
      publishedAt: release.published_at || '',
      notes: release.body || '',
    },
    asset: asset ? {
      name: asset.name || `SonicTopography-${latestVersion}-Setup.exe`,
      size: asset.size || 0,
      downloadUrl: asset.browser_download_url || '',
    } : null,
  };
}

function getDownloadDir() {
  return process.env.SONIC_UPDATE_DOWNLOAD_DIR || path.join(appRoot, 'updates', 'downloads');
}

function jobPayload(job) {
  return {
    id: job.id,
    status: job.status,
    version: job.version,
    name: job.name,
    received: job.received,
    total: job.total,
    filePath: job.filePath,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

async function downloadJob(job) {
  try {
    job.status = 'downloading';
    job.updatedAt = Date.now();
    const response = await fetch(job.downloadUrl, {
      headers: { 'User-Agent': 'SonicTopographyUpdater' },
    });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    job.total = Number(response.headers.get('content-length') || job.total || 0);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    job.received = buffer.length;
    await fs.mkdir(path.dirname(job.filePath), { recursive: true });
    await fs.writeFile(job.filePath, buffer);
    job.status = 'ready';
    job.updatedAt = Date.now();
  } catch (error) {
    job.status = 'failed';
    job.error = error.message || 'Download failed';
    job.updatedAt = Date.now();
  }
}

async function startDownload() {
  const latest = await getLatestUpdate();
  if (!latest.configured) return { ok: false, error: 'UPDATE_SOURCE_NOT_CONFIGURED', latest };
  if (!latest.updateAvailable) return { ok: false, error: 'NO_UPDATE_AVAILABLE', latest };
  if (!latest.asset?.downloadUrl) return { ok: false, error: 'UPDATE_ASSET_MISSING', latest };

  const id = `${latest.latestVersion}-${Date.now()}`;
  const name = safeFileName(latest.asset.name || `SonicTopography-${latest.latestVersion}-Setup.exe`);
  const job = {
    id,
    status: 'queued',
    version: latest.latestVersion,
    name,
    downloadUrl: latest.asset.downloadUrl,
    received: 0,
    total: latest.asset.size || 0,
    filePath: path.join(getDownloadDir(), name),
    error: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  downloadJobs.set(id, job);
  downloadJob(job);
  return { ok: true, job: jobPayload(job), latest };
}

async function readRequestJson(req) {
  return await new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function writeJsonResponse(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function handleRoute(req, res, parsedUrl, writeJson = writeJsonResponse) {
  try {
    if (parsedUrl.pathname === '/api/update/latest') {
      writeJson(res, 200, await getLatestUpdate());
      return true;
    }

    if (parsedUrl.pathname === '/api/update/download') {
      if (!['POST', 'GET'].includes(req.method || '')) return false;
      if (!req.body) await readRequestJson(req);
      writeJson(res, 200, await startDownload());
      return true;
    }

    if (parsedUrl.pathname === '/api/update/download/status') {
      const id = parsedUrl.searchParams.get('id') || '';
      const job = downloadJobs.get(id);
      writeJson(res, job ? 200 : 404, job ? { ok: true, job: jobPayload(job) } : { ok: false, error: 'DOWNLOAD_JOB_NOT_FOUND' });
      return true;
    }
  } catch (error) {
    writeJson(res, 500, { ok: false, error: error.message || 'Update request failed' });
    return true;
  }
  return false;
}

export function registerUpdateExpressRoutes(app) {
  app.use(async (req, res, next) => {
    const parsedUrl = new URL(req.originalUrl || req.url || '', 'http://localhost');
    if (await handleRoute(req, res, parsedUrl, (response, status, payload) => response.status(status).json(payload))) return;
    next();
  });
}

export function registerUpdateViteMiddlewares(server, writeJson) {
  server.middlewares.use(async (req, res, next) => {
    const parsedUrl = new URL(req.url || '', 'http://localhost');
    if (!parsedUrl.pathname.startsWith('/api/update/')) {
      next();
      return;
    }
    if (await handleRoute(req, res, parsedUrl, writeJson)) return;
    next();
  });
}
