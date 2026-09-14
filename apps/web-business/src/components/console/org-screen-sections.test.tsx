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
    // Members and Places are the Organization page's (MESITA-1841); Credits
    // is its own page; Mesita Capital and Activity left in MESITA-1828.
    expect(html).not.toContain("Members");
    expect(html).not.toContain(">Add place<");
    expect(html).not.toContain("Mesita Capital");
    expect(html).not.toContain("one feed");
    expect(html).not.toContain(SOON_STRIPS.credits.title);
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

  it("leaves no Soon strip behind on Payments (MESITA-1841)", () => {
    // Every box on this page is now live. A dashed row among them would be the
    // only unreal thing on a page about real money.
    expect(render()).not.toContain("border-dashed");
  });

  it("keeps the Credits copy honest wherever it renders (MESITA-1828)", () => {
    // The strip moved to its own page; the promise it makes did not change,
    // and this is still the only place that constant is declared.
    expect(SOON_STRIPS.credits.title).toBe("Prepaid Credits");
    expect(SOON_STRIPS.credits.line).toContain("outstanding liability will live here.");
    expect(SOON_STRIPS.credits.line).not.toMatch(/advance|loan|rate|%/i);
  });
});
