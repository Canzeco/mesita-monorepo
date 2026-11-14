// MVP test rule (MESITA-2600): only the money guard stays; UI pins were removed (MESITA-2601).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { IdentityCard } from "@/components/consumer/IdentityCard";
import {
  ClassBody,
  ClassList,
  ClassSheet,
} from "@/components/consumer/me/ClassSheet";
import { toGuestClass, toGuestPlan } from "@/lib/guest-standing";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back() {}, replace() {} }),
}));

// The sheet portals into the page; here it renders in place.
vi.mock("@/components/consumer/overlay/LocalOverlay", () => ({
  LocalSheet: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div data-sheet>{children}</div> : null),
  LocalDialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div data-dialog>{children}</div> : null),
}));

const text = (html: string) =>
  html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

// Class is back on the card beside the name (MESITA-3833); Plan is not
// (MESITA-3830).
describe("Class on the identity card", () => {
  const card = (guestClass: "regular" | "vip" | null, door = false) =>
    renderToStaticMarkup(
      <IdentityCard
        name="Ana"
        avatarUrl={null}
        instagram={{ label: "ana••• · 1.2K followers" }}
        guestClass={guestClass}
        onClassPress={door ? () => {} : undefined}
      />,
    );

  it("never shows Plan", () => {
    const html = card("regular");
    expect(html).not.toContain("data-identity-plan");
    expect(text(html)).not.toMatch(/\bFree\b|\bPro Plan\b/);
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
  // VIP is never bought, and Class is automatic (MESITA-3850): no button at all.
  it("never names a plan, a price or a buy button", () => {
    const html = renderToStaticMarkup(<ClassSheet open onClose={() => {}} />);
    const words = text(html);
    expect(words).not.toMatch(
      /\b(Free|Premier|Premium|Pro|Diamond|Select|Upgrade|Buy)\b/,
    );
    expect(words).not.toMatch(/\$\s?\d|\d+\s?%\s?off/i);
    expect(html).not.toMatch(/<(button|input|form)\b/);
  });
});

// Label guard: the files that name Class or Plan never state an undecided
// number.
describe("Class and Plan labels", () => {
  const read = (...p: string[]) =>
    readFileSync(join(__dirname, "../..", ...p), "utf8");
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
      expect(s, name).not.toMatch(/\d+\s?%\s?off/i);
      expect(s, name).not.toMatch(/\b3 reservations\b/);
    }
  });
});

// Me's Class tile opens /me/class: the sheet's body in a page (MESITA-2562).
// Class is automatic (MESITA-3850); the guest's own class sits on top
// (MESITA-3873). Before the profile is read, neither class is marked.
describe("the Class page body", () => {
  it("shows both classes and marks neither before the profile is read", () => {
    const html = renderToStaticMarkup(<ClassList />);
    expect(html.match(/data-class-row=/g)).toHaveLength(2);
    expect(html).not.toContain("data-class-soon");
    expect(html).not.toContain("data-class-mine");
  });
});

// A failed profile read never guesses a class (MESITA-3873).
describe("the Class status card", () => {
  it("states no class when the profile read failed", () => {
    const html = renderToStaticMarkup(
      <ClassBody status={{ kind: "unknown" }} />,
    );
    expect(html).not.toMatch(/Regular Class|VIP Class/);
    expect(html).not.toContain("data-class-mine");
  });
});
