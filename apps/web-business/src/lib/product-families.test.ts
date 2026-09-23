// THE GATE UNDER THE SHARED RECORD (MESITA-2037).
//
// `PRODUCT_FAMILY` is keyed by the UNION of both consoles' product keys, not
// by this app's `ProductKey`, and it has to be: the two unions differ — this
// app has twenty keys, web-business sixteen, and only web-business still
// carries `rewards`. A `Record<string, FamilyKey>` is the only shape that can
// serve both, and the price of that shape is that `tsc` will not notice a key
// with no family.
//
// So the type check moves here. A seventeenth product added to
// `PRODUCT_KEYS` without a family fails `pnpm test` in the app that added it,
// which is the whole reason `familyOf` is allowed to fall back instead of
// throwing: production gets a wrong tint, never a blank screen, and this file
// is what stops it reaching production.
//
// Generated copy of shared/product-families.ts (sync-shared). It
// asserts the SAME property against a DIFFERENT union — this one still
// includes `rewards`, which the mock folded into `visits` at MESITA-1953 and
// which this console has not ported (MESITA-2018) — and that is a thing one
// shared test cannot do.
import { describe, expect, it } from "vitest";
import { PRODUCT_KEYS, type ProductKey } from "@/lib/product-keys";
import {
  FAMILY,
  FAMILY_KEYS,
  FAMILY_STYLE,
  familyOf,
  PRODUCT_FAMILY,
} from "@/lib/product-families";

describe("product families", () => {
  it("gives every product in this app's vocabulary a family", () => {
    const orphans = PRODUCT_KEYS.filter(
      (key: ProductKey) => PRODUCT_FAMILY[key] === undefined,
    );
    expect(orphans).toEqual([]);
  });

  it("names a family that exists", () => {
    for (const key of PRODUCT_KEYS) {
      expect(FAMILY_KEYS).toContain(familyOf(key));
    }
  });

  it("keeps Pato's family order", () => {
    // The order is dictated, and it is what a legend or a grouped catalogue
    // would print. A sort that "tidies" it is the failure this pins.
    expect([...FAMILY_KEYS]).toEqual([
      "presence",
      "operations",
      "money",
      "loyalty",
      "automation",
      "insights",
    ]);
  });

  it("carries Pato's hex for every family, unaltered", () => {
    // The BASE is his value and nothing may round it. The inks are derived and
    // are checked for contrast below rather than pinned by hand.
    expect(Object.fromEntries(FAMILY_KEYS.map((f) => [f, FAMILY[f].color])))
      .toEqual({
        presence: "#E23D69",
        operations: "#2F6FEB",
        money: "#22A559",
        loyalty: "#F08C00",
        automation: "#9146E8",
        insights: "#0B8A92",
      });
  });

  it("gives every family a full style set and a distinct hue", () => {
    for (const f of FAMILY_KEYS) {
      const style = FAMILY_STYLE[f];
      for (const slot of ["tint", "tintStrong", "ink", "accent", "focus", "hover"] as const) {
        expect(style[slot], `${f}.${slot}`).toBeTruthy();
      }
      // THE CLASS NAMES MUST NAME THIS FAMILY. A copy-paste that left
      // `bg-family-presence-tint` on the money record would render a green
      // product pink, silently, and no type would object.
      expect(style.tint).toContain(f);
      expect(style.ink).toContain(f);
    }
    const hues = FAMILY_KEYS.map((f) => FAMILY[f].color);
    expect(new Set(hues).size).toBe(hues.length);
  });

  it("keeps every ink above 4.5:1 on the surface it is written on", () => {
    // WCAG AA for normal text. The BASE hue fails this for four of the six —
    // loyalty #F08C00 is 2.48:1 on white — which is the entire reason an ink
    // exists. Light ink is measured on the card (#ffffff), dark ink on the
    // dark card (#262626, `oklch(0.269 0 0)`).
    for (const f of FAMILY_KEYS) {
      expect(contrast(FAMILY[f].ink, "#ffffff"), `${f} light`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(FAMILY[f].inkDark, "#262626"), `${f} dark`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the focus ring above 3:1, which is why it is the ink", () => {
    // WCAG 1.4.11: a ring is a UI component boundary and owes 3:1 against the
    // surface it is drawn on. THE BASE HUE DOES NOT CLEAR IT — loyalty
    // #F08C00 is 2.48:1 on the card — which is the whole reason `focus` reads
    // `ring-family-<f>-ink` and not `ring-family-<f>`. This assertion is what
    // found that; do not "simplify" the ring back to the base.
    for (const f of FAMILY_KEYS) {
      expect(FAMILY_STYLE[f].focus).toContain(`ring-family-${f}-ink`);
      expect(contrast(FAMILY[f].ink, "#ffffff"), `${f} ring`).toBeGreaterThanOrEqual(3);
      expect(contrast(FAMILY[f].inkDark, "#262626"), `${f} ring dark`).toBeGreaterThanOrEqual(3);
    }
  });

  it("records the base hue as a fill only, and never as a ring or a letter", () => {
    // The base's two jobs are the wash and the plate: large fills behind a
    // glyph, which carry no contrast requirement. This pins that nothing in
    // the style set hands it a job that does.
    for (const f of FAMILY_KEYS) {
      const style = FAMILY_STYLE[f];
      expect(style.tint).toBe(`bg-family-${f}-tint`);
      expect(style.tintStrong).toBe(`bg-family-${f}-tint-strong`);
      expect(style.ink).toBe(`text-family-${f}-ink`);
      expect(style.focus).not.toContain(`ring-family-${f} `);
    }
  });
});

/** WCAG 2.x relative-luminance contrast. Written out rather than pulled in:
 *  it is nine lines, and this app already refuses a dependency it can spell
 *  out in nine lines. */
function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
