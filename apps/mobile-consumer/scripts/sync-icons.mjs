// Writes src/components/icon-nodes.ts from assets/icons/*.svg, so `Icon` can
// draw each one at any stroke weight. `--check` fails when the file is stale.
//
//   node scripts/sync-icons.mjs [--check]

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "assets/icons");
const to = join(root, "src/components/icon-nodes.ts");

const TAGS = ["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"];
/** The ink an icon is drawn in; the caller's colour replaces it. */
const INK = "#000";
/** A brand mark keeps its own colours, named by their token in src/theme.ts. */
const TONES = { "#FBBC05": "googleYellow", "#EA4335": "googleRed", "#34A853": "googleGreen", "#4285F4": "googleBlue", "#F4212E": "premier", "#FFF": "onInk" };

function attrs(text) {
  const out = {};
  for (const [, key, value] of text.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)) out[key] = value;
  return out;
}

function read(file) {
  const svg = readFileSync(join(from, file), "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const open = /<svg\b([^>]*)>/.exec(svg);
  if (!open) throw new Error(`${file}: no <svg>`);
  const top = attrs(open[1]);
  if (!top.viewBox) throw new Error(`${file}: no viewBox`);
  const nodes = [];
  for (const [, tag, body] of svg.slice(open.index + open[0].length).matchAll(/<([a-zA-Z]+)\b([^>]*?)\/?>/g)) {
    if (!TAGS.includes(tag)) throw new Error(`${file}: <${tag}> is not drawn by Icon`);
    nodes.push([tag, attrs(body)]);
  }
  if (nodes.length === 0) throw new Error(`${file}: nothing to draw`);
  const filled = top.fill === INK || nodes.some(([, a]) => a.fill === INK);
  for (const [, a] of nodes) {
    if (a.fill === INK) delete a.fill;
    // A filled dot inside an outline icon (lucide's currentColor): the caller's colour.
    else if (a.fill === "currentColor") a.fill = "@";
    else if (a.fill !== undefined && a.fill !== "none" && a.fill !== "@") {
      const tone = TONES[a.fill.toUpperCase()];
      if (!tone) throw new Error(`${file}: fill ${a.fill} has no token in TONES`);
      delete a.fill;
      a.tone = tone;
    }
  }
  return { box: top.viewBox, filled, stroked: top.stroke !== undefined, nodes };
}

const files = readdirSync(from)
  .filter((name) => name.endsWith(".svg"))
  .sort();
const lines = files.map((file) => `  ${JSON.stringify(file.slice(0, -4))}: ${JSON.stringify(read(file))},`);
const text = `// Written by scripts/sync-icons.mjs from assets/icons/*.svg. Never edited by hand.

export type IconNode = [tag: string, attrs: Record<string, string> & { tone?: string }];
export type IconShape = { box: string; filled: boolean; stroked: boolean; nodes: IconNode[] };

export const ICONS = {
${lines.join("\n")}
} satisfies Record<string, IconShape>;
`;

if (process.argv.includes("--check")) {
  if (readFileSync(to, "utf8") !== text) {
    console.error("ICONS STALE: src/components/icon-nodes.ts differs from assets/icons. Run: node scripts/sync-icons.mjs");
    process.exit(1);
  }
  console.log(`icons: ${files.length} in sync`);
} else {
  writeFileSync(to, text);
  console.log(`icons: wrote ${files.length}`);
}
