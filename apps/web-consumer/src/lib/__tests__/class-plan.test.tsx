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
}));

const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

// The card shows Instagram and Class only; Plan is a tile on Me's grid,
// never a chip (Pato, MESITA-2576: "don't show the plan here. Only instagram
// and class.").
describe("Class on the identity card, and no Plan", () => {
  const card = (
    guestClass: "regular" | "vip" | null,
    door = false,
  ) =>
    renderToStaticMarkup(
      <IdentityCard
        name="Ana"
        avatarUrl={null}
        instagram={{ label: "ana••• · 1.2K followers" }}
        guestClass={guestClass}
        onClassPress={door ? () => {} : undefined}
      />,
    );

  it("shows Instagram, then Class, and never a Plan chip (MESITA-2576)", () => {
    for (const html of [card("vip"), card("regular"), card("vip", true)]) {
      expect(html).not.toContain("data-identity-plan");
      expect(html).not.toContain("lucide-credit-card");
      expect(text(html)).not.toMatch(/\b(Free|Premium|Plan)\b/);
    }
    const html = card("vip");
    expect(html.indexOf("data-identity-instagram")).toBeLessThan(html.indexOf("data-identity-class"));
    expect(html).toContain('aria-label="Class: VIP"');
    expect(html).toContain("lucide-crown");
    expect(html).not.toContain("lucide-gem");
  });

  it("shows Regular too, never a missing chip", () => {
    expect(card("regular")).toContain('aria-label="Class: Regular"');
  });

  it("hides Class when it is unknown, never a guessed Regular", () => {
    const html = card(null);
    expect(html).not.toContain("data-identity-class");
    expect(text(html)).not.toMatch(/Regular/);
  });

  it("makes Class a door on Me and a fact on Social", () => {
    expect(card("vip")).not.toContain("<button");
    expect(card("vip", true)).toMatch(/<button[^>]*aria-label="Class: VIP"/);
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
    expect(words).not.toMatch(/\b(Free|Premium|Pro|Diamond|Select|Upgrade|Buy)\b/);
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
      expect(strings(src), name).not.toMatch(/Diamond|\bPro\b|Mesita Select|Select tier/);
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
    expect(strings(CLASS)).not.toMatch(/"[^"]*\b(Free|Premium|Pro)\b[^"]*"|>[^<]*\b(Free|Premium|Pro)\b[^<]*</);
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
    expect(text(html)).not.toMatch(/Premium|Free|Pro\b/);
  });
});

// Me's Instagram chip: "@handle · 1.2K followers" (MESITA-2574), the same
// rounding Social uses.
describe("Instagram with followers", () => {
  it("adds the rounded count only once connected", async () => {
    const { instagramWithFollowers } = await import("@/lib/consumer-identity");
    expect(instagramWithFollowers("@pato", 1290, true)).toBe("@pato · 1.2K followers");
    expect(instagramWithFollowers("@pato", 0, true)).toBe("@pato");
    expect(instagramWithFollowers("@pato", null, true)).toBe("@pato");
    expect(instagramWithFollowers("Connect it", 5000, false)).toBe("Connect it");
  });
});
