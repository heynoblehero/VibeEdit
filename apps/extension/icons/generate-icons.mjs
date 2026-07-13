// Generates the extension's PNG icons from an inline SVG using sharp.
// Run: bun run apps/extension/icons/generate-icons.mjs
// (sharp is resolved from apps/web/node_modules — see the import path.)
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../web/package.json"),
);
const sharp = require("sharp");

const here = dirname(fileURLToPath(import.meta.url));

// On-brand: lime (#d4ff3a) rounded square + black play glyph — matches the
// VibeEdit wordmark badge (lime background, black text).
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="128" height="128" rx="28" fill="#d4ff3a"/>
  <path d="M50 38 L94 64 L50 90 Z" fill="#070709"/>
</svg>`;

const sizes = [16, 48, 128];
for (const size of sizes) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(join(here, `icon-${size}.png`));
  console.log(`wrote icon-${size}.png`);
}
