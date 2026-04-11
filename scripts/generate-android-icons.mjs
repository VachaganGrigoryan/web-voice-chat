import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const publicPath = path.join(projectRoot, 'public');
const brandPath = path.join(publicPath, 'brand');
const symbolSvgPath = path.join(brandPath, 'logo-symbol.svg');
const wordmarkLightSvgPath = path.join(brandPath, 'logo-wordmark-light.svg');
const faviconSvgPath = path.join(brandPath, 'favicon.svg');
const rootFaviconPath = path.join(publicPath, 'favicon.svg');
const androidResPath = path.join(projectRoot, 'mobile', 'android', 'app', 'src', 'main', 'res');
const blackBackground = '#0a0a0a';

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

const webIcons = [
  { fileName: 'favicon-32x32.png', size: 32, background: null, padding: 0.08 },
  { fileName: 'apple-touch-icon.png', size: 180, background: blackBackground, padding: 0.18 },
  { fileName: 'app-icon-192.png', size: 192, background: blackBackground, padding: 0.18 },
  { fileName: 'app-icon-512.png', size: 512, background: blackBackground, padding: 0.18 },
];

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
  const [symbolSvg, wordmarkLightSvg] = await Promise.all([
    readFile(symbolSvgPath, 'utf8'),
    readFile(wordmarkLightSvgPath, 'utf8'),
  ]);

  await copyFile(faviconSvgPath, rootFaviconPath);

  await Promise.all([
    ...webIcons.map((spec) =>
      writeRaster(
        path.join(brandPath, spec.fileName),
        awaitRenderIcon(symbolSvg, spec.size, spec.background, spec.padding),
      ),
    ),
    ...Object.entries(foregroundSizes).map(([density, size]) =>
      writeRaster(
        path.join(androidResPath, `mipmap-${density}`, 'ic_launcher_foreground.png'),
        awaitRenderIcon(symbolSvg, size, null, 0.19),
      ),
    ),
    ...Object.entries(legacySizes).flatMap(([density, size]) => [
      writeRaster(
        path.join(androidResPath, `mipmap-${density}`, 'ic_launcher.png'),
        awaitRenderIcon(symbolSvg, size, blackBackground, 0.2),
      ),
      writeRaster(
        path.join(androidResPath, `mipmap-${density}`, 'ic_launcher_round.png'),
        awaitRenderIcon(symbolSvg, size, blackBackground, 0.2),
      ),
    ]),
    ...splashSpecs.map((spec) =>
      writeRaster(
        path.join(androidResPath, spec.folder, 'splash.png'),
        awaitRenderSplash(wordmarkLightSvg, spec.width, spec.height, spec.widthRatio),
      ),
    ),
  ]);
}

async function writeRaster(filePath, rasterPromise) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await sharp(await rasterPromise).png().toFile(filePath);
}

async function awaitRenderIcon(symbolSvg, size, background, padding) {
  const wrappedSvg = wrapSymbolSvg(symbolSvg, background, padding);
  return sharp(Buffer.from(wrappedSvg)).resize(size, size).png().toBuffer();
}

async function awaitRenderSplash(wordmarkSvg, width, height, widthRatio) {
  const wrappedSvg = wrapSvgOnCanvas(wordmarkSvg, {
    canvasWidth: width,
    canvasHeight: height,
    background: blackBackground,
    maxWidthRatio: widthRatio,
  });
  return sharp(Buffer.from(wrappedSvg)).png().toBuffer();
}

function wrapSymbolSvg(symbolSvg, background, padding) {
  return wrapSvgOnCanvas(symbolSvg, {
    canvasWidth: 1024,
    canvasHeight: 1024,
    background,
    maxWidthRatio: 1 - padding * 2,
    maxHeightRatio: 1 - padding * 2,
    cornerRadiusRatio: background ? 0.22 : 0,
  });
}

function wrapSvgOnCanvas(svg, options) {
  const {
    canvasWidth,
    canvasHeight,
    background = null,
    maxWidthRatio = 1,
    maxHeightRatio = 1,
    cornerRadiusRatio = 0,
  } = options;
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/i);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 512 512';
  const innerContent = svg
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');
  const contentWidth = canvasWidth * maxWidthRatio;
  const contentHeight = canvasHeight * maxHeightRatio;
  const offsetX = (canvasWidth - contentWidth) / 2;
  const offsetY = (canvasHeight - contentHeight) / 2;
  const cornerRadius = Math.min(canvasWidth, canvasHeight) * cornerRadiusRatio;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" fill="none">
  ${background ? `<rect width="${canvasWidth}" height="${canvasHeight}" rx="${cornerRadius}" fill="${background}" />` : ''}
  <svg
    x="${offsetX}"
    y="${offsetY}"
    width="${contentWidth}"
    height="${contentHeight}"
    viewBox="${viewBox}"
    fill="none"
    preserveAspectRatio="xMidYMid meet"
  >
    ${innerContent}
  </svg>
</svg>`;
}
