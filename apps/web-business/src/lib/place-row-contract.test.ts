// What the console row must keep true. These read the source because the
// failures they guard against are silent: a wrong URL still renders, and an
// unknown Tailwind class still compiles.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROW = readFileSync(
  path.join(__dirname, "../components/console/PlaceRow.tsx"),
  "utf8",
);

/** The row with its prose stripped. The file EXPLAINS which words are
 *  forbidden, so a naive search for them hits the explanation — the
 *  vocabulary assertions have to read the code, not the commentary. */
const ROW_CODE = ROW.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("PlaceRow photo contract", () => {
  // MESITA-1553: places.photos are full-resolution originals, 8MB ceiling,
  // up to 100 rows. Pointing an <img> at one is the whole bug.
  it("routes the thumb through placeThumbUrl", () => {
    expect(ROW).toContain("placeThumbUrl(place.photoUrl");
  });

  it("never puts the raw photo URL in an img src", () => {
    expect(ROW).not.toMatch(/src=\{\s*place\.photoUrl/);
  });

  it("lazy-loads the thumb", () => {
    expect(ROW).toContain('loading="lazy"');
  });

  // #1508's trap: web-business has ZERO @utility blocks, and Tailwind drops
  // unknown classes silently — it would compile, deploy, and look broken.
  // bg-pink-gradient is defined only in web-admin's globals.css.
  it("uses no utility that exists only in web-admin", () => {
    expect(ROW).not.toContain("pink-gradient");
  });
});

describe("PlaceRow vocabulary contract", () => {
  // The row may only render facts that exist in the schema. Both of these
  // appear in the draft taxonomy and in neither the columns nor the helpers.
  it("invents no place state", () => {
    expect(ROW_CODE).not.toMatch(/Adopted/i);
    expect(ROW_CODE).not.toMatch(/Visits (enabled|rewards)/i);
  });

  // MESITA-1372: Requested is request_count, an integer, not a boolean.
  it("renders Requested as a count", () => {
    expect(ROW).toContain("place.requestCount");
    expect(ROW).toMatch(/Requested \$\{requests\}/);
  });

  it("shows the org as identity, and says so when there is none", () => {
    expect(ROW).toContain("place.organizationName");
    expect(ROW).toContain("No organization");
  });

  // Listed is the visibility fact and is the one chip that must always
  // render — its ABSENCE is what an operator scans a list for.
  it("always renders the Listed chip, both ways", () => {
    expect(ROW).toContain('"Listed"');
    expect(ROW).toContain('"Not listed"');
  });

  // Enriched and the meter are different facts, and the live data has them
  // disagreeing (enriched_at set, high-water 3). The meter must not sit in
  // an else-branch behind Enriched, or a half-filled profile reads complete.
  it("renders the intake meter independently of Enriched", () => {
    const enrichedAt = ROW_CODE.indexOf('"enriched"');
    const meterAt = ROW_CODE.indexOf("Intake $");
    expect(enrichedAt).toBeGreaterThan(-1);
    expect(meterAt).toBeGreaterThan(-1);
    // The meter's own `if` is not chained to the enriched branch.
    const between = ROW_CODE.slice(enrichedAt, meterAt);
    expect(between).not.toMatch(/}\s*else\s*if[^}]*intakeTotal/);
  });
});
