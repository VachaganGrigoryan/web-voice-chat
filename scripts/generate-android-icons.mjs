import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const publicPath = path.join(projectRoot, 'public');
const brandPath = path.join(publicPath, 'brand');
const symbolSvgPath = path.join(brandPath, 'logo-symbol.svg');
const faviconSvgPath = path.join(brandPath, 'favicon.svg');
const rootFaviconPath = path.join(publicPath, 'favicon.svg');
const androidResPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const symbolSvg = await readFile(symbolSvgPath, 'utf8');

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

function wrapSymbolSvg(symbolSvg, background, padding) {
  const viewBoxMatch = symbolSvg.match(/viewBox="([^"]+)"/i);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 512 512';
  const innerContent = symbolSvg
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');

  const canvasSize = 1024;
  const inset = canvasSize * padding;
  const innerSize = canvasSize - inset * 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}" fill="none">
  ${background ? `<rect width="${canvasSize}" height="${canvasSize}" rx="${canvasSize * 0.22}" fill="${background}" />` : ''}
  <svg x="${inset}" y="${inset}" width="${innerSize}" height="${innerSize}" viewBox="${viewBox}" fill="none">
    ${innerContent}
  </svg>
</svg>`;
}
