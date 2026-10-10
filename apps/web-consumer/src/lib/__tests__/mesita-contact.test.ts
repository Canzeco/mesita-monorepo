import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DRAFT_DATE } from "@/components/legal/legal";
import { MESITA_PRIVACY_URL, MESITA_TERMS_URL } from "@/lib/mesita-contact";

// The legal rows on Me › Support point at pages THIS app serves.
//
// They used to point at a sibling app, and for months that app had no such
// routes, so both rows 404'd with every check green. The pin is now on both
// halves at once: the URL names this app's host, and the page behind each
// path exists here and renders through the shared draft shell.

const SRC = join(__dirname, "..", "..");

describe("the legal rows and the pages behind them", () => {
  it("point at consumer.mesita.ai, never www.", () => {
    expect(MESITA_TERMS_URL).toBe("https://consumer.mesita.ai/terms");
    expect(MESITA_PRIVACY_URL).toBe("https://consumer.mesita.ai/privacy");
  });

  it.each([
    ["terms", MESITA_TERMS_URL],
    ["privacy", MESITA_PRIVACY_URL],
  ])("/%s is a page in this app, through the draft shell", (route, url) => {
    expect(new URL(url).pathname).toBe(`/${route}`);
    const page = join(SRC, "app", route, "page.tsx");
    expect(existsSync(page)).toBe(true);
    const src = readFileSync(page, "utf8");
    expect(src).toContain("LegalPage");
    expect(src).toContain("@/components/legal/legal");
  });

  it("marks both pages an unreviewed, dated draft", () => {
    const shell = readFileSync(join(SRC, "components", "legal", "legal.tsx"), "utf8");
    expect(shell).toContain("has not been reviewed by a lawyer");
    expect(shell).toContain("{DRAFT_DATE}");
    expect(DRAFT_DATE.length).toBeGreaterThan(0);
  });
});
