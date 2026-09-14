// The Payments page's composition (MESITA-1832; the Organization page's
// until then). The order is a product decision and this file pins it.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Organization, PaymentAccount } from "@/lib/api/organizations";
import { ORG_SCREEN_ORDER, PaymentsSections, SOON_STRIPS } from "./OrgScreenSections";

const ORG: Organization = {
  id: "org-1",
  name: "Org Test",
  legalName: null,
  rfc: null,
  currency: "MXN",
  myRole: "owner",
  placeCount: 0,
  places: [],
  partnered: false,
  mesitaPayEnabled: false,
} as unknown as Organization;

const READY: PaymentAccount = {
  stripe_account_id: "acct_1",
  charges_enabled: true,
  details_submitted: true,
  payouts_enabled: true,
} as unknown as PaymentAccount;

function render(over: Partial<{ org: Organization; account: PaymentAccount | null; orphaned: boolean }> = {}) {
  return renderToStaticMarkup(
    <PaymentsSections org={over.org ?? ORG} account={over.account ?? null} orphaned={over.orphaned ?? false} />,
  );
}

describe("the Payments page composition", () => {
  it("pins the approved order constant", () => {
    // Credits left in MESITA-1841: it has a rail row now, so it has a page.
    expect(ORG_SCREEN_ORDER).toEqual(["stripe", "partner"]);
  });

  it("renders the boxes in that order, and nothing that moved elsewhere", () => {
    const html = render();
    const positions = ["Stripe Account", "Partner"].map((t) => html.indexOf(t));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    // Members and Places are the Organization page's (MESITA-1841); Mesita
    // Capital and Activity left in MESITA-1828.
    expect(html).not.toContain("Members");
    expect(html).not.toContain(">Add place<");
    expect(html).not.toContain("Mesita Capital");
    expect(html).not.toContain("one feed");
  });

  // MESITA-1845: Credits had its own page for one issue and merged back here
  // on Pato's one word — "merge" — when Payments took its rail row again. It
  // is LAST, below both live boxes: an unbuilt thing never sits above a built
  // one, or the page opens on a promise instead of on the money.
  it("ends with Prepaid Credits, the page's one unbuilt box", () => {
    const html = render();
    expect(html).toContain(SOON_STRIPS.credits.title);
    expect(html.indexOf(SOON_STRIPS.credits.title)).toBeGreaterThan(
      html.indexOf("Partner"),
    );
    expect(html).toContain("Soon");
  });

  it("labels the Partner switch Partner, never Not Partner or Patner", () => {
    const html = render();
    expect(html).toContain("Partner");
    expect(html).not.toContain("Not Partner");
    expect(html).not.toContain("Patner");
  });

  it("locks Partner until Stripe is charge-ready", () => {
    const html = render();
    expect(html).toContain("Needs a Ready Stripe account");
    expect(html).not.toContain('role="switch"');
  });

  it("offers the Partner switch once Stripe is Ready, and never when orphaned", () => {
    const html = render({ account: READY });
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-label="Partner"');
    expect(html).not.toContain("Needs a Ready Stripe account");
    expect(render({ account: READY, orphaned: true })).not.toContain('role="switch"');
  });

  it("names Mesita Pay, Visit Rewards and Accept Prepays when Partner is on", () => {
    const html = render({ account: READY, org: { ...ORG, partnered: true } as Organization });
    expect(html).toContain("Mesita Pay");
    expect(html).toContain("Visit Rewards");
    expect(html).toContain("Accept Prepays");
  });

  it("has exactly ONE dashed row — the unbuilt engine, and nothing else", () => {
    // Dashed reads "not yet real" against the solid live Sections. Two of them
    // and a page about real money starts looking like a mockup.
    expect((render().match(/border-dashed/g) ?? []).length).toBe(1);
  });

  it("keeps the Credits copy honest wherever it renders (MESITA-1828)", () => {
    // The strip left for its own page and came back; the promise it makes did
    // not change, and this is still the only place that constant is declared.
    expect(SOON_STRIPS.credits.title).toBe("Prepaid Credits");
    expect(SOON_STRIPS.credits.line).toContain("outstanding liability will live here.");
    expect(SOON_STRIPS.credits.line).not.toMatch(/advance|loan|rate|%/i);
  });

  it("Customers promises a feed and no number (MESITA-1845)", () => {
    // Same house law: an unbuilt engine shows Soon, never a fake count. A
    // "0 customers" on a page whose engine does not exist is a lie about the
    // business, not a zero state.
    expect(SOON_STRIPS.customers.title).toBe("Customers");
    expect(SOON_STRIPS.customers.line).not.toMatch(/\d/);
  });
});
