import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// CHAT HAS NO DIVIDER LINES (Pato, MESITA-2148: "fix the stupid lines in
// chat"). The header, the suggestions and the composer sit on the page's own
// ground; nothing rules them off from the conversation. The composer keeps its
// own bordered box — that is the input, not a divider.
const SRC = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

describe("Chat draws no hairline dividers", () => {
  it.each([
    "components/consumer/home/MemoModeHeader.tsx",
    "components/consumer/search/AskAiPanel.tsx",
  ])("%s has no border-t / border-b", (rel) => {
    expect(read(rel)).not.toMatch(/\bborder-[tb]\b/);
  });
});
