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
    expect(ORG_SCREEN_ORDER).toEqual(["stripe", "partner", "credits"]);
  });

  it("renders the boxes in that order, and nothing that moved elsewhere", () => {
    const html = render();
    const positions = ["Stripe Account", "Partner", SOON_STRIPS.credits.title].map((t) => html.indexOf(t));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    // Members are on /settings, Places on /account (MESITA-1832).
    expect(html).not.toContain("Members");
    expect(html).not.toContain(">Add place<");
    expect(html).not.toContain("Mesita Capital");
    expect(html).not.toContain("one feed");
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

  it("keeps the ONE Soon strip honest: dashed, one line, no knobs (MESITA-1828)", () => {
    const html = render();
    expect(html.match(/border-dashed/g)?.length).toBe(1);
    expect(html).toContain("outstanding liability will live here.");
    expect(SOON_STRIPS.credits.line).not.toMatch(/advance|loan|rate|%/i);
  });
});
