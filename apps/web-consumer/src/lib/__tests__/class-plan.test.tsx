// MVP test rule (MESITA-2600): only the money guard stays; UI pins were removed (MESITA-2601).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { IdentityCard } from "@/components/consumer/IdentityCard";
import { toGuestPlan } from "@/lib/guest-standing";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back() {}, replace() {} }),
}));

const text = (html: string) =>
  html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

// Neither Plan (MESITA-3830) nor Class (MESITA-4306) is on the card.
describe("the identity card", () => {
  const card = () =>
    renderToStaticMarkup(
      <IdentityCard
        name="Ana"
        avatarUrl={null}
        instagram={{ label: "ana••• · 1.2K followers" }}
      />,
    );

  it("never shows Plan or Class", () => {
    const html = card();
    expect(html).not.toContain("data-identity-plan");
    expect(html).not.toContain("data-identity-class");
    expect(text(html)).not.toMatch(/\bFree\b|\bPro Plan\b|Regular|VIP/);
  });

  it("reads unknown or retired plans as the plain default", () => {
    expect(toGuestPlan("pro")).toBe("free");
    expect(toGuestPlan(undefined)).toBe("free");
  });
});

// Label guard: the files that name Plan never state an undecided
// number.
describe("Plan labels", () => {
  const read = (...p: string[]) =>
    readFileSync(join(__dirname, "../..", ...p), "utf8");
  const PLAN = read("components", "consumer", "me", "PlanModal.tsx");
  const FILES = {
    PLAN,
    // The rows' words moved out of the file above (MESITA-2701).
    PLAN_WORDS: read("components", "consumer", "me", "plan-words.ts"),
    CARD: read("components", "consumer", "IdentityCard.tsx"),
    LABELS: read("lib", "guest-standing.ts"),
    PERKS: read("components", "consumer", "me", "perk-list.tsx"),
  };
  // String literals only: comments may explain the history.
  const strings = (src: string) =>
    src
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[^]*?\*\//g, "")
      .match(/"[^"\n]*"|`[^`]*`|>[^<>{}\n]+</g)
      ?.join("\n") ?? "";

  it("states no undecided price, discount or lifetime cap", () => {
    for (const [name, src] of Object.entries(FILES)) {
      const s = strings(src);
      expect(s, name).not.toMatch(/\$\s?\d/);
      expect(s, name).not.toMatch(/\d+\s?%\s?off/i);
      expect(s, name).not.toMatch(/\b3 reservations\b/);
    }
  });
});
