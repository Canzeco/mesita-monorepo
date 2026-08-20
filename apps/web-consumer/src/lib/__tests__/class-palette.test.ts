import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CLASSES, classBadgeClass } from "@/lib/consumer-data";

// The metals drifted twice before this existed: Silver shipped as a hue-250
// blue that shared a family with Diamond, gold's dark stop landed on bronze's
// hue, and white ink sat on three light fills at under 2:1. All four are
// measurable off the stylesheet, so they are measured here rather than
// re-reviewed by eye. Reads the REAL globals.css — a palette edit that breaks
// a rule fails here, not in a screenshot three weeks later.

const CSS = readFileSync(
  join(__dirname, "..", "..", "app", "globals.css"),
  "utf8",
);

type Oklch = { L: number; C: number; H: number };

function oklch(css: string): Oklch {
  const m = css.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/);
  if (!m) throw new Error(`not an oklch color: ${css}`);
  return { L: +m[1], C: +m[2], H: +m[3] };
}

function token(name: string): string {
  const m = CSS.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`token --${name} not found`);
  return m[1].trim();
}

/** Both stops of a `--gradient-*`, light end first. */
function gradientStops(metal: string): Oklch[] {
  const raw = token(`gradient-${metal}`).replace(/\s+/g, " ");
  const found = raw.match(/oklch\([^)]+\)/g) ?? [];
  expect(found, `--gradient-${metal} should have two oklch stops`).toHaveLength(
    2,
  );
  return found.map(oklch);
}

function toSrgb({ L, C, H }: Oklch): [number, number, number] {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((v) => Math.min(1, Math.max(0, v))) as [
    number,
    number,
    number,
  ];
}

function luminance(c: Oklch): number {
  const [r, g, b] = toSrgb(c);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Oklch, b: Oklch): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE: Oklch = { L: 1, C: 0, H: 0 };
const INK = oklch(token("foreground"));
const CARD = oklch(token("card"));

// Each metal's exclusive hue band. Silver is exempt: a neutral has no
// meaningful hue, which is the point — it is separated by chroma instead.
const HUE_BANDS: Record<string, [number, number]> = {
  bronze: [35, 60],
  gold: [78, 100],
  diamond: [200, 240],
};

const METALS = CLASSES.map((c) => c.id);

describe("every metal keeps to its own hue band", () => {
  it.each(Object.entries(HUE_BANDS))("%s stays inside %j", (metal, band) => {
    const [lo, hi] = band;
    for (const stop of [...gradientStops(metal), oklch(token(`tier-${metal}`))]) {
      expect(stop.H).toBeGreaterThanOrEqual(lo);
      expect(stop.H).toBeLessThanOrEqual(hi);
    }
  });

  it("the bands do not touch — bronze and gold collided once", () => {
    const bands = Object.values(HUE_BANDS).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i][0]).toBeGreaterThan(bands[i - 1][1]);
    }
  });

  it("silver is a neutral, not a blue", () => {
    for (const stop of [...gradientStops("silver"), oklch(token("tier-silver"))]) {
      expect(stop.C).toBeLessThanOrEqual(0.008);
    }
  });
});

describe("ink is readable on the fill it is paired with", () => {
  it.each(METALS)("%s clears 3:1 at BOTH gradient stops", (metal) => {
    const ink = classBadgeClass(metal).includes("text-white") ? WHITE : INK;
    for (const stop of gradientStops(metal)) {
      expect(contrast(stop, ink)).toBeGreaterThanOrEqual(3);
    }
  });

  it("only Bronze — the floor, the one dark metal — carries white", () => {
    const white = METALS.filter((m) => classBadgeClass(m).includes("text-white"));
    expect(white).toEqual(["bronze"]);
  });
});

describe("the solids are text, and are legible as text", () => {
  it.each(METALS)("--tier-%s clears 4.5:1 on card", (metal) => {
    expect(contrast(oklch(token(`tier-${metal}`)), CARD)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("nothing paints a background from a --tier-* solid", () => {
    // Every `.bg-tier-*` must reach for a gradient; a solid there would be an
    // untuned fill, since the solids are sized for ink contrast only.
    const bgRules = CSS.match(/\.bg-tier-[a-z]+\s*\{[^}]*\}/g) ?? [];
    expect(bgRules.length).toBeGreaterThan(0);
    for (const rule of bgRules) expect(rule).toContain("var(--gradient-");
  });
});
