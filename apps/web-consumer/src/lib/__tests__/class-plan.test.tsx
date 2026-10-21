import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { IdentityCard } from "@/components/consumer/IdentityCard";
import { ClassSheet } from "@/components/consumer/me/ClassSheet";
import { toGuestClass, toGuestPlan } from "@/lib/guest-standing";

// The sheet portals into the page; here it renders in place.
vi.mock("@/components/consumer/overlay/LocalOverlay", () => ({
  LocalSheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-sheet>{children}</div> : null,
}));

const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

// Plan (Free/Pro) and Class (Regular/VIP) are two independent facts
// (Pato, MESITA-2553).
describe("Class and Plan on the identity card", () => {
  const card = (
    standing: Parameters<typeof IdentityCard>[0]["standing"],
    doors = false,
  ) =>
    renderToStaticMarkup(
      <IdentityCard
        name="Ana"
        avatarUrl={null}
        instagram={null}
        standing={standing}
        onClassPress={doors ? () => {} : undefined}
        showPlan={!doors}
      />,
    );

  it("shows Class, then Plan, each named for what it is", () => {
    const html = card({ guestClass: "vip", plan: "free" });
    expect(html.indexOf("data-identity-class")).toBeLessThan(html.indexOf("data-identity-plan"));
    expect(html).toContain('aria-label="Class: VIP"');
    expect(html).toContain('aria-label="Plan: Free"');
    expect(html).toContain("lucide-crown");
    expect(html).toContain("lucide-credit-card");
    expect(html).not.toContain("lucide-gem");
  });

  it("shows the plain defaults too, never a missing chip", () => {
    const html = card({ guestClass: "regular", plan: "pro" });
    expect(html).toContain('aria-label="Class: Regular"');
    expect(html).toContain('aria-label="Plan: Pro"');
  });

  it("hides the row when standing is unknown, never a guessed Free", () => {
    const html = card(null);
    expect(html).not.toContain("data-identity-standing");
    expect(text(html)).not.toMatch(/Free|Regular/);
  });

  it("makes Class a door on Me, and drops Plan there (MESITA-2559)", () => {
    const facts = card({ guestClass: "vip", plan: "pro" });
    expect(facts).not.toContain("<button");
    expect(facts).not.toContain("href=");
    expect(facts).toContain('aria-label="Plan: Pro"');
    const me = card({ guestClass: "vip", plan: "pro" }, true);
    expect(me).toMatch(/<button[^>]*aria-label="Class: VIP"/);
    expect(me).not.toContain("data-identity-plan");
    expect(me).not.toContain("Plan:");
  });

  it("reads unknown or retired values as the plain default", () => {
    expect(toGuestPlan("premium")).toBe("free");
    expect(toGuestPlan(undefined)).toBe("free");
    expect(toGuestClass("diamond")).toBe("regular");
    expect(toGuestClass("vip")).toBe("vip");
  });
});

describe("the Class sheet", () => {
  const sheet = (guestClass: "regular" | "vip") =>
    renderToStaticMarkup(<ClassSheet open onClose={() => {}} guestClass={guestClass} />);

  it("explains both classes, with VIP's one perk tagged Soon", () => {
    const html = sheet("regular");
    expect(html).toContain('data-class-row="Regular"');
    expect(html).toContain('data-class-row="VIP"');
    expect(html.match(/data-perk-soon/g)).toHaveLength(1);
    expect(text(html)).toContain("Never bought.");
  });

  it("marks the guest's own class, and a Regular guest gets one plain line", () => {
    const regular = sheet("regular");
    expect(regular).toMatch(/data-class-row="Regular"[^]*data-class-mine/);
    expect(regular).toContain("data-class-regular-note");
    const vip = sheet("vip");
    expect(vip.match(/data-class-mine/g)).toHaveLength(1);
    expect(vip).toMatch(/data-class-row="VIP"[^]*data-class-mine/);
    expect(vip).not.toContain("data-class-regular-note");
  });

  it("never names a plan, a price or a buy button", () => {
    const words = text(sheet("regular"));
    expect(words).not.toMatch(/\b(Free|Pro|Premium|Diamond|Select|Upgrade|Buy)\b/);
    expect(words).not.toMatch(/\$\s?\d|\d+\s?% off/);
    expect(sheet("regular")).not.toContain("<button");
  });
});

// Label guard: the files that name Class or Plan never use a retired word,
// never cross the two axes, and never state an undecided number.
describe("Class and Plan labels", () => {
  const read = (...p: string[]) => readFileSync(join(__dirname, "../..", ...p), "utf8");
  const PLAN = read("components", "consumer", "me", "PlanModal.tsx");
  const CLASS = read("components", "consumer", "me", "ClassSheet.tsx");
  const FILES = {
    PLAN,
    CLASS,
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

  it("uses no retired or invented name", () => {
    for (const [name, src] of Object.entries(FILES)) {
      expect(strings(src), name).not.toMatch(/Diamond|Premium|Mesita Select|Select tier/);
    }
  });

  it("states no undecided price, discount or lifetime cap", () => {
    for (const [name, src] of Object.entries(FILES)) {
      const s = strings(src);
      expect(s, name).not.toMatch(/\$\s?\d/);
      expect(s, name).not.toMatch(/\d+\s?% off/);
      expect(s, name).not.toMatch(/\b3 reservations\b/);
    }
  });

  it("keeps the axes apart: Plan copy never names Class, Class copy never names a plan", () => {
    expect(strings(PLAN)).not.toMatch(/\b(VIP|Regular|Class)\b/);
    expect(strings(CLASS)).not.toMatch(/"[^"]*\b(Free|Pro)\b[^"]*"|>[^<]*\b(Free|Pro)\b[^<]*</);
  });
});
