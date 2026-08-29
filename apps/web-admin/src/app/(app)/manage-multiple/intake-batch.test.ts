import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { IntakeAction } from "./intake-batch";

const here = dirname(fileURLToPath(import.meta.url));

describe("IntakeAction", () => {
  it("is create, enrich, or update — no third create_enrich function", () => {
    const actions: IntakeAction[] = ["create", "enrich", "update"];
    expect(actions).toEqual(["create", "enrich", "update"]);
    const batch = readFileSync(join(here, "intake-batch.ts"), "utf8");
    expect(batch).toContain('export type IntakeAction = "create" | "enrich" | "update"');
    expect(batch).toContain("create then enrich");
    expect(batch).not.toContain("create_enrich");
  });
});
