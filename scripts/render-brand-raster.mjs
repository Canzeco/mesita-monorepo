#!/usr/bin/env node
// render-brand-raster.mjs — regenerate the PNG and PDF logo exports from the
// generated SVGs in assets/brand/svg/.
//
// This is a LOCAL tool, deliberately NOT part of `deno task sync-brand` and NOT
// run in CI: it shells out to a headless Chrome that only exists on a designer's
// or developer's machine. The SVGs are the source; these exports are conveniences
// for slide decks, print, and app-store listings.
//
//   node scripts/render-brand-raster.mjs
//
// Chrome renders the SVG at the requested pixel size (PNG, transparent) and
// prints it to a page sized exactly to the artwork (PDF, still vector).

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const svgDir = join(repoRoot, "assets", "brand", "svg");
const pngDir = join(repoRoot, "assets", "brand", "png");
const pdfDir = join(repoRoot, "assets", "brand", "pdf");
const favDir = join(repoRoot, "assets", "brand", "favicon");
const tmp = join(repoRoot, ".brand-render-tmp");

const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => existsSync(p));

if (!CHROME) {
  console.error(
    "No Chrome/Chromium found. Install Google Chrome, or re-export these\n" +
      "assets from a design tool. The SVGs in assets/brand/svg/ are the source.",
  );
  process.exit(1);
}

/** name → output width in px. Height follows the artwork's aspect ratio. */
const TARGETS = [
  { name: "mark", width: 1024 },
  { name: "mark-badge", width: 1024, opaque: true, variants: [""] },
  { name: "wordmark", width: 1400 },
  { name: "logo-horizontal", width: 1600 },
  { name: "logo-stacked", width: 1400 },
];
const VARIANTS = ["-color", "-black", "-white"];

const viewBoxOf = (svg) => svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);

mkdirSync(tmp, { recursive: true });
for (const d of [pngDir, pdfDir, favDir]) mkdirSync(d, { recursive: true });

function page(svg, w, h, opaque) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${w}px ${h}px; margin: 0 }
    html,body { margin:0; padding:0; width:${w}px; height:${h}px;
                background:${opaque ? "#ffffff" : "transparent"}; }
    svg { display:block; width:${w}px; height:${h}px }
  </style></head><body>${svg}</body></html>`;
}

function chrome(args) {
  execFileSync(CHROME, ["--headless", "--disable-gpu", "--hide-scrollbars", ...args], {
    stdio: ["ignore", "ignore", "pipe"],
  });
}

let n = 0;
function render(svgFile, outBase, width, { opaque = false, pdf = true } = {}) {
  const svg = readFileSync(join(svgDir, svgFile), "utf8").replace(/<!--[\s\S]*?-->/, "").trim();
  const [, , vbW, vbH] = viewBoxOf(svg);
  const height = Math.round((width * vbH) / vbW);
  const html = join(tmp, `${outBase.replace(/\//g, "_")}.html`);
  writeFileSync(html, page(svg, width, height, opaque));

  const pngOut = join(pngDir, `${outBase}.png`);
  chrome([
    `--screenshot=${pngOut}`,
    `--window-size=${width},${height}`,
    ...(opaque ? [] : ["--default-background-color=00000000"]),
    `file://${html}`,
  ]);
  console.log(`png  ${outBase}.png  ${width}x${height}`);
  n++;

  if (pdf) {
    const pdfOut = join(pdfDir, `${outBase}.pdf`);
    chrome([`--print-to-pdf=${pdfOut}`, "--no-pdf-header-footer", `file://${html}`]);
    console.log(`pdf  ${outBase}.pdf`);
    n++;
  }
}

for (const t of TARGETS) {
  for (const v of t.variants ?? VARIANTS) {
    render(`${t.name}${v}.svg`, `${t.name}${v}`, t.width, { opaque: t.opaque });
  }
}

// Favicons: browser tabs take the bare pink mark; iOS home screens can't do
// transparency well, so they take the pink badge with the white flame.
render("mark-color.svg", "../favicon/browser", 512, { pdf: false });
render("mark-badge.svg", "../favicon/iphone", 1024, { opaque: true, pdf: false });

rmSync(tmp, { recursive: true, force: true });
console.log(`\nrender-brand-raster: ${n + 2} files written.`);
