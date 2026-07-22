#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const sourcePath = path.join(root, 'tmp', 'map', 'index.php');
const outDir = path.join(root, 'public', 'map');
const outPath = path.join(outDir, 'default-markers.json');

function decodeHtmlEntities(input) {
  return input
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'");
}

function parseIconMap(source) {
  const map = new Map();
  const iconRe = /var\s+(icon\d+)\s*=\s*L\.icon\(\{\s*iconUrl:\s*"([^"]+)"/g;
  for (const match of source.matchAll(iconRe)) {
    map.set(match[1], match[2]);
  }
  return map;
}

function parseLayerNames(source) {
  const map = new Map();
  const layerRe = /"([^"]+)":\s*layerGroup(\d+)/g;
  for (const match of source.matchAll(layerRe)) {
    map.set(`layerGroup${match[2]}`, decodeHtmlEntities(match[1]));
  }
  return map;
}

function parsePopupTitles(source) {
  const map = new Map();
  const popupRe =
    /var\s+popupContent(\d+)\s*=\s*`[\s\S]*?<h1[^>]*>\s*ID:\s*\d+\s*\|\s*([^<\n\r]+)[\s\S]*?`/g;
  for (const match of source.matchAll(popupRe)) {
    map.set(match[1], decodeHtmlEntities(match[2]).trim());
  }
  return map;
}

function parseMarkers(source, iconMap, layerNames, popupTitles) {
  const markers = [];
  const markerRe =
    /L\.marker\(map\.unproject\(\[(\d+),\s*(\d+)\],\s*map\.getMaxZoom\(\)\),\s*\{icon:\s*(icon\d+)\}\)\s*\.bindPopup\(popupContent(\d+)\)\s*\.addTo\((layerGroup\d+)\);/g;

  for (const match of source.matchAll(markerRe)) {
    const x = Number(match[1]);
    const y = Number(match[2]);
    const iconVar = match[3];
    const popupId = match[4];
    const layerGroup = match[5];

    markers.push({
      id: popupId,
      x,
      y,
      iconUrl: iconMap.get(iconVar) ?? null,
      layerGroup,
      layerName: layerNames.get(layerGroup) ?? layerGroup,
      title: popupTitles.get(popupId) ?? `Point ${popupId}`
    });
  }

  return markers;
}

async function run() {
  const source = await readFile(sourcePath, 'utf-8');
  const iconMap = parseIconMap(source);
  const layerNames = parseLayerNames(source);
  const popupTitles = parsePopupTitles(source);
  const markers = parseMarkers(source, iconMap, layerNames, popupTitles);

  await mkdir(outDir, { recursive: true });
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: 'tmp/map/index.php',
        mapWidth: 16128,
        mapHeight: 24320,
        maxZoom: 7,
        markers
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`Generated ${markers.length} markers -> ${path.relative(root, outPath)}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

