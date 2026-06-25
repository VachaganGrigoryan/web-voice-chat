import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const publicPath = path.join(projectRoot, 'public');
const brandPath = path.join(publicPath, 'brand');
const sourceBrandPath = path.join(projectRoot, '..', 'vogi_transparent_assets');
const androidResPath = path.join(projectRoot, 'mobile', 'android', 'app', 'src', 'main', 'res');
const blackBackground = '#0a0a0a';

const brandSources = {
  symbol: path.join(sourceBrandPath, 'vogi-symbol-1254x1254.png'),
  splashWordmark: path.join(sourceBrandPath, 'vogi-full-2508x627.png'),
};

const sourceBrandFiles = [
  'vogi-full-1024x256.png',
  'vogi-full-128x32.png',
  'vogi-full-2048x512.png',
  'vogi-full-2508x627.png',
  'vogi-full-256x64.png',
  'vogi-full-512x128.png',
  'vogi-symbol-1024x1024.png',
  'vogi-symbol-1254x1254.png',
  'vogi-symbol-128x128.png',
  'vogi-symbol-256x256.png',
  'vogi-symbol-512x512.png',
  'vogi-symbol-64x64.png',
];

const foregroundSizes = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};

const legacySizes = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

const splashSpecs = [
  { folder: 'drawable', width: 480, height: 320, widthRatio: 0.68 },
  { folder: 'drawable-port-mdpi', width: 320, height: 480, widthRatio: 0.76 },
  { folder: 'drawable-port-hdpi', width: 480, height: 800, widthRatio: 0.76 },
  { folder: 'drawable-port-xhdpi', width: 720, height: 1280, widthRatio: 0.76 },
  { folder: 'drawable-port-xxhdpi', width: 960, height: 1600, widthRatio: 0.76 },
  { folder: 'drawable-port-xxxhdpi', width: 1280, height: 1920, widthRatio: 0.76 },
  { folder: 'drawable-land-mdpi', width: 480, height: 320, widthRatio: 0.68 },
  { folder: 'drawable-land-hdpi', width: 800, height: 480, widthRatio: 0.68 },
  { folder: 'drawable-land-xhdpi', width: 1280, height: 720, widthRatio: 0.68 },
  { folder: 'drawable-land-xxhdpi', width: 1600, height: 960, widthRatio: 0.68 },
  { folder: 'drawable-land-xxxhdpi', width: 1920, height: 1280, widthRatio: 0.68 },
];

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  await Promise.all([
    ...sourceBrandFiles.map((fileName) =>
      copyFile(path.join(sourceBrandPath, fileName), path.join(brandPath, fileName)),
    ),
    ...Object.entries(foregroundSizes).map(([density, size]) =>
      writeRaster(
        path.join(androidResPath, `mipmap-${density}`, 'ic_launcher_foreground.png'),
        renderSquarePng(brandSources.symbol, size),
      ),
    ),
    ...Object.entries(legacySizes).flatMap(([density, size]) => [
      writeRaster(
        path.join(androidResPath, `mipmap-${density}`, 'ic_launcher.png'),
        renderSquarePng(brandSources.symbol, size),
      ),
      writeRaster(
        path.join(androidResPath, `mipmap-${density}`, 'ic_launcher_round.png'),
        renderSquarePng(brandSources.symbol, size),
      ),
    ]),
    ...splashSpecs.map((spec) =>
      writeRaster(
        path.join(androidResPath, spec.folder, 'splash.png'),
        renderSplashPng(brandSources.splashWordmark, spec.width, spec.height, spec.widthRatio),
      ),
    ),
  ]);
}

async function writeRaster(filePath, rasterPromise) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await sharp(await rasterPromise).png().toFile(filePath);
}

async function renderSquarePng(sourcePath, size) {
  return sharp(sourcePath).resize(size, size).png().toBuffer();
}

async function renderSplashPng(sourcePath, width, height, widthRatio) {
  const wordmarkBuffer = await sharp(sourcePath)
    .resize({
      width: Math.round(width * widthRatio),
      height: Math.round(height * 0.42),
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: blackBackground,
    },
  })
    .composite([{ input: wordmarkBuffer, gravity: 'center' }])
    .png()
    .toBuffer();
}
