import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(FRONTEND_ROOT, '..');

function getArg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;

  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) return fallback;

  return value;
}

function safeReadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeOsId(value) {
  return String(value || '').replace(/^os-/i, '').trim();
}

function imageExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return ext;
  return '.png';
}

function defaultManifestPath(osId) {
  return path.join(
    PROJECT_ROOT,
    'dji-smartfarm-robot',
    'downloads-dji',
    `os-${osId}-v2`,
    `os_${osId}_manifest_relatorio_dji.json`
  );
}

function copyManifestImages(manifestPath) {
  const manifest = safeReadJson(manifestPath);
  const osId = normalizeOsId(getArg('--os-id', manifest.osId || '134'));
  const outDir = path.join(FRONTEND_ROOT, 'public', 'dji-reports', `os-${osId}`);
  ensureDir(outDir);

  const publicManifest = {
    osId,
    generatedAt: new Date().toISOString(),
    sourceManifestPath: manifestPath,
    sourceGeneratedAt: manifest.generatedAt || null,
    matchingMode: manifest.matchingMode || null,
    applications: [],
  };

  let copied = 0;
  let skipped = 0;

  for (const application of manifest.applications || []) {
    const applicationId = application.applicationId;
    const imagePath = application.applicationImagePath;

    if (!applicationId || !imagePath || application.imageStatus !== 'READY') {
      skipped += 1;
      continue;
    }

    if (!fs.existsSync(imagePath)) {
      skipped += 1;
      continue;
    }

    const ext = imageExtension(imagePath);
    const fileName = `${applicationId}${ext}`;
    const destinationPath = path.join(outDir, fileName);
    fs.copyFileSync(imagePath, destinationPath);
    copied += 1;

    publicManifest.applications.push({
      applicationId,
      imageStatus: application.imageStatus,
      djiDate: application.djiDate || null,
      imageUrl: `/dji-reports/os-${osId}/${fileName}`,
      fileName,
      source: 'public-local',
      djiSourceImagePath: application.djiSourceImagePath || null,
    });
  }

  const manifestOutPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestOutPath, JSON.stringify(publicManifest, null, 2), 'utf8');

  return {
    osId,
    copied,
    skipped,
    outDir,
    manifestOutPath,
  };
}

const explicitManifest = getArg('--manifest');
const osId = normalizeOsId(getArg('--os-id', '134'));
const manifestPath = explicitManifest
  ? path.resolve(explicitManifest)
  : defaultManifestPath(osId);

if (!fs.existsSync(manifestPath)) {
  console.error(`[ERRO] Manifest nao encontrado: ${manifestPath}`);
  process.exit(1);
}

const result = copyManifestImages(manifestPath);
console.log(`[OK] OS: ${result.osId}`);
console.log(`[OK] Imagens copiadas: ${result.copied}`);
console.log(`[INFO] Itens ignorados: ${result.skipped}`);
console.log(`[OK] Pasta publica: ${result.outDir}`);
console.log(`[OK] Manifest publico: ${result.manifestOutPath}`);
