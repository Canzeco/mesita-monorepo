// MVP test rule (MESITA-2600): only the money guard stays; UI pins were removed (MESITA-2601).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { IdentityCard } from "@/components/consumer/IdentityCard";
import { ClassList, ClassSheet } from "@/components/consumer/me/ClassSheet";
import { ConnectorModal } from "@/components/consumer/me/ConnectorModal";
import { toGuestClass, toGuestPlan } from "@/lib/guest-standing";

vi.mock("next/navigation", () => ({ useRouter: () => ({ back() {}, replace() {} }) }));

// The sheet portals into the page; here it renders in place.
vi.mock("@/components/consumer/overlay/LocalOverlay", () => ({
  LocalSheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-sheet>{children}</div> : null,
  LocalDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-dialog>{children}</div> : null,
}));

const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

// One fact per line under the photo: the name, Instagram + followers,
// Class, Plan (Pato, MESITA-2595: "then class in one line / then plan in
// other line"). Plan is back on the card (it left in MESITA-2576).
describe("Class and Plan on the identity card", () => {
  const card = (
    guestClass: "regular" | "vip" | null,
    door = false,
    plan: "free" | "premium" | null = "free",
  ) =>
    renderToStaticMarkup(
      <IdentityCard
        name="Ana"
        avatarUrl={null}
        instagram={{ label: "ana••• · 1.2K followers" }}
        guestClass={guestClass}
        onClassPress={door ? () => {} : undefined}
        plan={plan}
        planHref={door ? "/me/plan" : undefined}
      />,
    );

  it("hides Plan when it is unknown, never a guessed Free", () => {
    const html = card("regular", false, null);
    expect(html).not.toContain("data-identity-plan");
    expect(text(html)).not.toMatch(/\bFree\b/);
  });

  it("hides Class when it is unknown, never a guessed Regular", () => {
    const html = card(null);
    expect(html).not.toContain("data-identity-class");
    expect(text(html)).not.toMatch(/Regular/);
  });

  it("reads unknown or retired values as the plain default", () => {
    expect(toGuestPlan("pro")).toBe("free");
    expect(toGuestPlan(undefined)).toBe("free");
    expect(toGuestClass("diamond")).toBe("regular");
    expect(toGuestClass("vip")).toBe("vip");
  });
});

describe("the Class sheet", () => {
  const sheet = (guestClass: "regular" | "vip") =>
    renderToStaticMarkup(
      <ClassSheet
        open
        onClose={() => {}}
        guestClass={guestClass}
        instagram={{ handle: "diego", followers: 5000 }}
      />,
    );

  // VIP is joined, never bought (MESITA-3054): the only buttons a Regular
  // guest sees are the two Joins.
  it("never names a plan, a price or a buy button", () => {
    const html = sheet("regular");
    const words = text(html);
    expect(words).not.toMatch(/\b(Free|Premier|Premium|Pro|Diamond|Select|Upgrade|Buy)\b/);
    expect(words).not.toMatch(/\$\s?\d|\d+\s?% off/);
    const buttons = [...html.matchAll(/<button[^>]*>([^]*?)<\/button>/g)].map((m) => text(m[1]).trim());
    expect(buttons).toEqual(["Join with Instagram", "Join"]);
    // A VIP's only button is leaving it.
    const vipButtons = [...sheet("vip").matchAll(/<button[^>]*>([^]*?)<\/button>/g)].map((m) =>
      text(m[1]).trim()
    );
    expect(vipButtons).toEqual(["Leave VIP"]);
  });
});

// Label guard: the files that name Class or Plan never state an undecided
// number.
describe("Class and Plan labels", () => {
  const read = (...p: string[]) => readFileSync(join(__dirname, "../..", ...p), "utf8");
  const PLAN = read("components", "consumer", "me", "PlanModal.tsx");
  const CLASS = read("components", "consumer", "me", "ClassSheet.tsx");
  const FILES = {
    PLAN,
    CLASS,
    // The rows' words moved out of the two files above (MESITA-2701).
    PLAN_WORDS: read("components", "consumer", "me", "plan-words.ts"),
    CLASS_WORDS: read("components", "consumer", "me", "class-words.ts"),
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
      expect(s, name).not.toMatch(/\d+\s?% off/);
      expect(s, name).not.toMatch(/\b3 reservations\b/);
    }
  });
});

// Me's Class tile opens /me/class: the sheet's body in a page (MESITA-2562).
describe("the Class page body", () => {
  it("marks neither class when the read failed, and adds no Regular note", () => {
    const html = renderToStaticMarkup(<ClassList guestClass={null} />);
    expect(html).toContain('data-class-row="Regular"');
    expect(html).toContain('data-class-row="VIP"');
    expect(html).not.toContain("data-class-mine");
    expect(html).not.toContain("data-class-regular-note");
  });
});

// Connector is not built (MESITA-2562): every line Soon, no button, no plan.
describe("the Connector page", () => {
  const html = renderToStaticMarkup(<ConnectorModal />);
  it("promises nothing live", () => {
    expect(html).toContain("ChatGPT or Claude");
    const items = html.match(/<li\b/g) ?? [];
    const soon = html.match(/data-perk-soon/g) ?? [];
    expect(items.length).toBeGreaterThan(0);
    expect(soon).toHaveLength(items.length);
    // The header's Back is the only button.
    expect(html.match(/<button\b/g)).toHaveLength(1);
    expect(text(html)).not.toMatch(/Premier|Premium|Free|Pro\b/);
  });
});
