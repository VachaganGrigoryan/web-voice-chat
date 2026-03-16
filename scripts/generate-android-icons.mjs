import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

const projectRoot = process.cwd();
const svgPath = path.join(projectRoot, 'public', 'favicon.svg');
const androidResPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

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

const ANDROID_WHITE = { r: 255, g: 255, b: 255, a: 255 };

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const source = await readFile(svgPath, 'utf8');
  const svg = parseSvg(source);

  await Promise.all([
    ...Object.entries(foregroundSizes).map(([density, size]) =>
      writePng(
        path.join(androidResPath, `mipmap-${density}`, 'ic_launcher_foreground.png'),
        renderIcon({
          size,
          svg,
          background: null,
          symbolScale: 0.76,
        }),
      ),
    ),
    ...Object.entries(legacySizes).flatMap(([density, size]) => {
      const square = renderIcon({
        size,
        svg,
        background: {
          kind: 'disc',
          color: ANDROID_WHITE,
          radiusFraction: 0.455,
        },
        symbolScale: 0.60,
      });
      const round = renderIcon({
        size,
        svg,
        background: {
          kind: 'disc',
          color: ANDROID_WHITE,
          radiusFraction: 0.455,
        },
        symbolScale: 0.60,
      });

      return [
        writePng(path.join(androidResPath, `mipmap-${density}`, 'ic_launcher.png'), square),
        writePng(path.join(androidResPath, `mipmap-${density}`, 'ic_launcher_round.png'), round),
      ];
    }),
  ]);
}

function parseSvg(source) {
  const viewBoxMatch = source.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) {
    throw new Error('`public/favicon.svg` is missing a viewBox.');
  }

  const [, minX, minY, width, height] = viewBoxMatch[1].split(/\s+/).map(Number);
  const circles = [...source.matchAll(/<circle\s+([^>]+?)\s*\/?>/g)].map((match) =>
    parseCircle(match[1]),
  );

  if (circles.length === 0) {
    throw new Error('`public/favicon.svg` does not contain any circle elements to rasterize.');
  }

  const bounds = circles.reduce(
    (acc, circle) => {
      const halfStroke = circle.strokeWidth / 2;
      const outerRadius = circle.r + halfStroke;
      return {
        minX: Math.min(acc.minX, circle.cx - outerRadius),
        minY: Math.min(acc.minY, circle.cy - outerRadius),
        maxX: Math.max(acc.maxX, circle.cx + outerRadius),
        maxY: Math.max(acc.maxY, circle.cy + outerRadius),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );

  return {
    viewBox: { minX, minY, width, height },
    circles,
    bounds,
  };
}

function parseCircle(attributesSource) {
  const attributes = Object.fromEntries(
    [...attributesSource.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
  );

  return {
    cx: Number(attributes.cx),
    cy: Number(attributes.cy),
    r: Number(attributes.r),
    fill: parseColor(attributes.fill),
    stroke: parseColor(attributes.stroke),
    strokeWidth: Number(attributes['stroke-width'] ?? 0),
  };
}

function parseColor(value) {
  if (!value || value === 'none') {
    return null;
  }

  const normalized = value.trim();
  if (!normalized.startsWith('#')) {
    throw new Error(`Unsupported color format in favicon: ${normalized}`);
  }

  const hex = normalized.slice(1);
  if (hex.length === 6) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: 255,
    };
  }

  throw new Error(`Unsupported hex color length in favicon: ${normalized}`);
}

function renderIcon({ size, svg, background, symbolScale }) {
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let color = { r: 0, g: 0, b: 0, a: 0 };

      if (background) {
        const coverage = sampleCoverage(x, y, size, (px, py) => coversBackground(background, px, py, size));
        color = blend(color, background.color, coverage);
      }

      for (const circle of svg.circles) {
        const coverage = sampleCoverage(x, y, size, (px, py) =>
          coversCircle(svg, circle, px, py, size, symbolScale),
        );

        if (circle.stroke) {
          const strokeCoverage = sampleCoverage(x, y, size, (px, py) =>
            coversCircleStroke(svg, circle, px, py, size, symbolScale),
          );
          color = blend(color, circle.stroke, strokeCoverage);
        }

        if (circle.fill) {
          color = blend(color, circle.fill, coverage);
        }
      }

      const index = (y * size + x) * 4;
      pixels[index] = color.r;
      pixels[index + 1] = color.g;
      pixels[index + 2] = color.b;
      pixels[index + 3] = color.a;
    }
  }

  return pixels;
}

function coversBackground(background, px, py, size) {
  if (background.kind !== 'disc') {
    return false;
  }

  const center = (size - 1) / 2;
  const radius = size * background.radiusFraction;
  return distance(px, py, center, center) <= radius;
}

function coversCircle(svg, circle, px, py, size, symbolScale) {
  const point = toSvgPoint(svg, px, py, size, symbolScale);
  return distance(point.x, point.y, circle.cx, circle.cy) <= circle.r;
}

function coversCircleStroke(svg, circle, px, py, size, symbolScale) {
  if (!circle.stroke || circle.strokeWidth <= 0) {
    return false;
  }

  const point = toSvgPoint(svg, px, py, size, symbolScale);
  const d = distance(point.x, point.y, circle.cx, circle.cy);
  const halfStroke = circle.strokeWidth / 2;
  return d >= circle.r - halfStroke && d <= circle.r + halfStroke;
}

function toSvgPoint(svg, px, py, size, symbolScale) {
  const contentWidth = svg.bounds.maxX - svg.bounds.minX;
  const contentHeight = svg.bounds.maxY - svg.bounds.minY;
  const targetSize = size * symbolScale;
  const scale = Math.min(targetSize / contentWidth, targetSize / contentHeight);
  const offsetX = (size - contentWidth * scale) / 2;
  const offsetY = (size - contentHeight * scale) / 2;

  return {
    x: svg.bounds.minX + (px - offsetX) / scale,
    y: svg.bounds.minY + (py - offsetY) / scale,
  };
}

function sampleCoverage(x, y, size, predicate) {
  let hits = 0;
  const samples = 4;

  for (let sy = 0; sy < samples; sy += 1) {
    for (let sx = 0; sx < samples; sx += 1) {
      const px = x + (sx + 0.5) / samples;
      const py = y + (sy + 0.5) / samples;
      if (predicate(px, py, size)) {
        hits += 1;
      }
    }
  }

  return hits / (samples * samples);
}

function blend(base, top, coverage) {
  if (!top || coverage <= 0) {
    return base;
  }

  const topAlpha = (top.a / 255) * coverage;
  const baseAlpha = base.a / 255;
  const outAlpha = topAlpha + baseAlpha * (1 - topAlpha);

  if (outAlpha <= 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const r = Math.round((top.r * topAlpha + base.r * baseAlpha * (1 - topAlpha)) / outAlpha);
  const g = Math.round((top.g * topAlpha + base.g * baseAlpha * (1 - topAlpha)) / outAlpha);
  const b = Math.round((top.b * topAlpha + base.b * baseAlpha * (1 - topAlpha)) / outAlpha);

  return { r, g, b, a: Math.round(outAlpha * 255) };
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

async function writePng(filePath, rgbaPixels) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, encodePng(rgbaPixels));
}

function encodePng(rgbaPixels) {
  const rgbaBuffer = Buffer.from(rgbaPixels);
  const pixelCount = rgbaBuffer.length / 4;
  const size = Math.sqrt(pixelCount);

  if (!Number.isInteger(size)) {
    throw new Error('PNG encoder received a non-square image buffer.');
  }

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);

  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgbaBuffer.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = makeChunk('IHDR', makeIhdrData(size, size));
  const idat = makeChunk('IDAT', deflateSync(raw));
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeIhdrData(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
