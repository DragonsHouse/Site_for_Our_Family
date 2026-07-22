import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(projectRoot, '..');
const roots = [
  path.join(repoRoot, 'chrome_app'),
  path.join(repoRoot, 'dragon-house-backend'),
];
const skipDirs = new Set(['.git', '.output', '.tmp', '.wxt', 'coverage', 'dist', 'map-cache', 'node_modules']);
const textExtensions = new Set([
  '.css',
  '.env',
  '.example',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.less',
  '.md',
  '.mjs',
  '.scss',
  '.sql',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const mojibakePattern =
  /(?:\u0420[\u00a0-\u00bf\u0400-\u040f\u0490\u0491\u2010-\u2122]|\u0421[\u0400-\u040f\u0490\u0491\u2010-\u2122]|\u0432[\u0400-\u040f]|\u0440[\u00a0-\u00bf\u0400-\u040f\u0490\u0491]|[\u0370-\u03ff]|\uFFFD)/gu;

function isTextFile(filePath) {
  const name = path.basename(filePath);
  return textExtensions.has(path.extname(name).toLowerCase()) || name.startsWith('.env');
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && skipDirs.has(entry.name)) continue;
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(entryPath, files);
    else if (isTextFile(entryPath)) files.push(entryPath);
  }
  return files;
}

const findings = [];
const bomFiles = [];
const invalidUtf8Files = [];

for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  for (const filePath of walk(root)) {
    const buffer = fs.readFileSync(filePath);
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      bomFiles.push(path.relative(repoRoot, filePath));
    }
    const text = buffer.toString('utf8');
    if (text.includes('\uFFFD')) invalidUtf8Files.push(path.relative(repoRoot, filePath));

    const samples = [];
    const lines = text.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      mojibakePattern.lastIndex = 0;
      if (mojibakePattern.test(lines[index])) {
        samples.push(`${index + 1}: ${lines[index].slice(0, 240)}`);
      }
      if (samples.length >= 8) break;
    }
    if (samples.length) {
      findings.push({
        file: path.relative(repoRoot, filePath),
        samples,
      });
    }
  }
}

if (bomFiles.length || invalidUtf8Files.length || findings.length) {
  console.log(JSON.stringify({ bomFiles, invalidUtf8Files, findings }, null, 2));
  process.exitCode = 1;
} else {
  console.log('UTF-8 audit passed: no BOM, invalid UTF-8, or mojibake patterns found.');
}
