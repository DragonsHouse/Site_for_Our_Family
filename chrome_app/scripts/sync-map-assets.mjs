#!/usr/bin/env node
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const REMOTE_MAP_URL = 'https://quantfun.com.ua/map/';
const REMOTE_BASE_URL = 'https://quantfun.com.ua';
const OUTPUT_ROOT = path.join(projectRoot, 'public', 'map-cache');
const OUTPUT_FILES_ROOT = path.join(OUTPUT_ROOT, 'files');
const MANIFEST_PATH = path.join(OUTPUT_ROOT, 'manifest.json');

const argv = process.argv.slice(2);
const includePopupImages = argv.includes('--include-popup-images');
const maxArg = argv.find((arg) => arg.startsWith('--max='));
const maxAssets =
  maxArg && Number.isFinite(Number(maxArg.slice('--max='.length)))
    ? Math.max(1, Number(maxArg.slice('--max='.length)))
    : null;

function unique(values) {
  return [...new Set(values)];
}

function normalizeRemotePath(urlOrPath) {
  try {
    const url = new URL(urlOrPath, REMOTE_BASE_URL);
    if (url.origin !== REMOTE_BASE_URL) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

function extractAssetsFromHtml(html, includeImages) {
  const relativePaths = [];
  const add = (value) => {
    const normalized = normalizeRemotePath(value);
    if (!normalized) return;
    relativePaths.push(normalized);
  };

  const staticRe = /(?:src|href)\s*=\s*["'](\/(?:static|media)\/[^"']+)["']/gi;
  for (const match of html.matchAll(staticRe)) {
    const candidate = match[1];
    if (!includeImages && candidate.startsWith('/media/map/images/')) {
      continue;
    }
    add(candidate);
  }

  const iconRe = /iconUrl:\s*["'](\/media\/map\/icons\/[^"']+)["']/gi;
  for (const match of html.matchAll(iconRe)) {
    add(match[1]);
  }

  const popupImageRe = /<img\s+src=['"](\/media\/map\/images\/[^'"]+)['"]/gi;
  if (includeImages) {
    for (const match of html.matchAll(popupImageRe)) {
      add(match[1]);
    }
  }

  return unique(relativePaths);
}

function toLocalFilePath(remotePathname) {
  const clean = remotePathname.replace(/^\/+/, '');
  return path.join(OUTPUT_FILES_ROOT, clean);
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

async function downloadAsset(remotePathname) {
  const remoteUrl = new URL(remotePathname, REMOTE_BASE_URL).toString();
  const localPath = toLocalFilePath(remotePathname);

  if (await fileExists(localPath)) {
    return { status: 'skipped', remotePathname, localPath };
  }

  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${remoteUrl}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(localPath), { recursive: true });
  await writeFile(localPath, buffer);

  return {
    status: 'downloaded',
    remotePathname,
    localPath,
    bytes: buffer.length,
    contentType: response.headers.get('content-type') ?? null
  };
}

async function loadPreviousManifest() {
  try {
    const raw = await readFile(MANIFEST_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function run() {
  await mkdir(OUTPUT_ROOT, { recursive: true });

  const mapResponse = await fetch(REMOTE_MAP_URL);
  if (!mapResponse.ok) {
    throw new Error(`Failed to fetch map page: HTTP ${mapResponse.status}`);
  }
  const html = await mapResponse.text();

  let assets = extractAssetsFromHtml(html, includePopupImages);
  if (maxAssets != null) {
    assets = assets.slice(0, maxAssets);
  }

  const previous = await loadPreviousManifest();
  const results = [];
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const asset of assets) {
    try {
      const result = await downloadAsset(asset);
      results.push(result);
      if (result.status === 'downloaded') downloaded += 1;
      else skipped += 1;
      console.log(`[${result.status}] ${asset}`);
    } catch (error) {
      failed += 1;
      results.push({
        status: 'failed',
        remotePathname: asset,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error(`[failed] ${asset}`);
    }
  }

  const manifest = {
    source: REMOTE_MAP_URL,
    fetchedAt: new Date().toISOString(),
    includePopupImages,
    totalAssets: assets.length,
    downloaded,
    skipped,
    failed,
    previousFetchedAt: previous?.fetchedAt ?? null,
    assets: results.map((entry) => ({
      status: entry.status,
      remotePathname: entry.remotePathname,
      localPath:
        entry.status === 'failed'
          ? null
          : path.relative(projectRoot, entry.localPath).replaceAll('\\', '/'),
      bytes: entry.status === 'downloaded' ? entry.bytes : null,
      contentType: entry.status === 'downloaded' ? entry.contentType : null,
      error: entry.status === 'failed' ? entry.error : null
    })),
    notes: [
      'Файли з tile-template типу /static/map/{z}/{x}/{y}.jpg докачуються окремо (по запиту/діапазону).',
      'Цей sync докачує лише відсутні локально файли.'
    ]
  };

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log('');
  console.log('Done.');
  console.log(`Assets: ${assets.length}`);
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Manifest: ${path.relative(projectRoot, MANIFEST_PATH).replaceAll('\\', '/')}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

