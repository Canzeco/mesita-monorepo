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
