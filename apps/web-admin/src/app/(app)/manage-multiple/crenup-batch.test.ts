import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it } from "vitest";

import type { CrenupAction } from "./crenup-batch";

const here = dirname(fileURLToPath(import.meta.url));

describe("CrenupAction", () => {
  it("is create, delete, list, unlist, or enrich — no Update, no combo function", () => {
    // Enforced by tsc (pnpm typecheck), not at vitest runtime.
    expectTypeOf<CrenupAction>().toEqualTypeOf<"create" | "delete" | "list" | "unlist" | "enrich">();
    const batch = readFileSync(join(here, "crenup-batch.ts"), "utf8");
    expect(batch).toContain(
      'export type CrenupAction = "create" | "delete" | "list" | "unlist" | "enrich"',
    );
    expect(batch).not.toContain("create_enrich");
    expect(batch).not.toContain('"update"');
  });
});
