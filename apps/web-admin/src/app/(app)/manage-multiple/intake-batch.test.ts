import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { IntakeAction } from "./intake-batch";

const here = dirname(fileURLToPath(import.meta.url));

describe("IntakeAction", () => {
  it("is create, delete, list, unlist, or enrich — no Update, no combo function", () => {
    const actions: IntakeAction[] = ["create", "delete", "list", "unlist", "enrich"];
    expect(actions).toEqual(["create", "delete", "list", "unlist", "enrich"]);
    const batch = readFileSync(join(here, "intake-batch.ts"), "utf8");
    expect(batch).toContain(
      'export type IntakeAction = "create" | "delete" | "list" | "unlist" | "enrich"',
    );
    expect(batch).not.toContain("create_enrich");
    expect(batch).not.toContain('"update"');
  });
});
