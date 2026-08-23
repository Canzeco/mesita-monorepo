// The type scale is duplicated, so it must be pinned (MESITA-1220).
//
// There is no root pnpm workspace — web-consumer and web-admin are independent
// install roots — so a shared module is not importable without publishing.
// The repo's existing answer is duplicate + pin, the same mechanism
// ticket-journey-drift uses for the frozen mobile app. `type-roles.ts` is pure
// data with zero platform deps precisely so the copies CAN be identical, which
// is also what will let mobile-consumer consume it on unfreeze (NativeWind has
// no @utility layer to generate from).
//
// If this fails: you edited one copy. Edit Notion Docs > Design first, then
// BOTH copies, in that order and the same session.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_TRACKING, TYPE_ROLES } from "../type-roles";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

const read = (app: string) =>
  readFileSync(join(REPO_ROOT, `apps/${app}/src/lib/type-roles.ts`), "utf8");

describe("type-roles drift (consumer ↔ admin)", () => {
  it("admin's copy is byte-identical to consumer's", () => {
    expect(read("web-admin")).toBe(read("web-consumer"));
  });

  it("every role the CSS generates is declared in the data", () => {
    // The @utility blocks are generated FROM type-roles.ts by hand today, so
    // this asserts the two never separate — the class-palette.test.ts pattern,
    // which parses the real stylesheet rather than trusting a comment.
    const roles = [...read("web-consumer").matchAll(/^\s*name: "([a-z-]+)",$/gm)].map(
      (m) => m[1],
    );
    expect(roles).toEqual(["meta", "label", "body", "eyebrow"]);

    for (const app of ["web-consumer", "web-admin"]) {
      const css = readFileSync(
        join(REPO_ROOT, `apps/${app}/src/app/globals.css`),
        "utf8",
      );
      for (const role of roles) {
        expect(css, `${app} is missing @utility type-${role}`).toContain(
          `@utility type-${role} {`,
        );
      }
    }
  });
});

// The ESLint guard's failure message (MESITA-1220) quotes eyebrow's size,
// weight and tracking in prose, by hand — a developer reads that string at
// the moment they're being told what to write, so a wrong number there is
// worse than one in a comment nobody opens. It drifted (MESITA-1223): the
// message said 10px/0.12em/bold while type-roles.ts said 0.75rem(12px)/
// 0.14em/500. These tests derive the expected values FROM TYPE_ROLES /
// LEGAL_TRACKING rather than hand-typing the fix, so the next edit to the
// eyebrow role — not just the next edit to the message — is what breaks this.
describe("eslint guard message quotes TYPE_ROLES, not a hand-typed literal (MESITA-1223)", () => {
  const eyebrow = TYPE_ROLES.find((r) => r.name === "eyebrow")!;
  const eyebrowPx = String(Math.round(parseFloat(eyebrow.size) * 16));
  const otherTracking = LEGAL_TRACKING.find((t) => t !== eyebrow.tracking)!;

  const readConfig = (app: string) =>
    readFileSync(join(REPO_ROOT, `apps/${app}/eslint.config.mjs`), "utf8");

  for (const app of ["web-consumer", "web-admin"]) {
    const config = readConfig(app);

    it(`${app}: the off-scale-size message states eyebrow's real size, weight and tracking`, () => {
      const m = config.match(
        /type-eyebrow\s+(\d+)px \+ uppercase \+ ([\d.]+em) \+ weight (\d+)/,
      );
      expect(m, "off-scale-size message no longer matches the expected shape").not.toBeNull();
      const [, px, tracking, weight] = m!;
      expect(px).toBe(eyebrowPx);
      expect(tracking).toBe(eyebrow.tracking);
      expect(weight).toBe(eyebrow.weight);
    });

    it(`${app}: the weight-collision message states the real weight`, () => {
      const m = config.match(/type-eyebrow sets (\d+)\./);
      expect(m, "weight-collision message no longer matches the expected shape").not.toBeNull();
      expect(m![1]).toBe(eyebrow.weight);
    });

    it(`${app}: the tracking-collision message states the real tracking and the real alternative`, () => {
      const set = config.match(
        /type-eyebrow already sets letter-spacing \(([\d.]+em), per §C\)/,
      );
      expect(set, "tracking-collision message no longer matches the expected shape").not.toBeNull();
      expect(set![1]).toBe(eyebrow.tracking);

      const alt = config.match(/other legal value[\s\S]{0,60}?\(([\d.]+em)\)/);
      expect(alt, "the 'other legal value' parenthetical was not found").not.toBeNull();
      expect(alt![1]).toBe(otherTracking);
    });
  }
});
