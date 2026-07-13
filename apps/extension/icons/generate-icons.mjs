// Generates the extension's PNG icons from an inline SVG using sharp.
// Run: bun run apps/extension/icons/generate-icons.mjs
// (sharp is resolved from apps/web/node_modules — see the import path.)
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../../web/package.json"));
const sharp = require("sharp");

const here = dirname(fileURLToPath(import.meta.url));

// Purple rounded square + white "send/play" glyph — matches the in-app accent.
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b6cff"/>
      <stop offset="1" stop-color="#6a45ff"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="128" height="128" rx="28" fill="url(#g)"/>
  <path d="M50 40 L92 64 L50 88 Z" fill="#ffffff"/>
  <circle cx="44" cy="64" r="8" fill="#ffffff" opacity="0.9"/>
</svg>`;

const sizes = [16, 48, 128];
for (const size of sizes) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(join(here, `icon-${size}.png`));
  console.log(`wrote icon-${size}.png`);
}
