// Pins the five-box composition — the product decision the autoplan gate
// approved (2026-09-06). The order lives in ORG_SCREEN_ORDER and in the
// rendered output; both are asserted so neither can drift alone. Rendered
// with renderToStaticMarkup against stub props: the page assembles data,
// OrgScreenSections owns composition, and this file needs no server mocks.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ORG_SCREEN_ORDER,
  OrgScreenSections,
  SOON_STRIPS,
} from "./OrgScreenSections";
import type {
  Organization,
  OrgMember,
  PaymentAccount,
  PendingOrgInvite,
} from "@/lib/api/organizations";

const ORG: Organization = {
  id: "org-1",
  name: "Test Org",
  legalName: null,
  rfc: null,
  currency: "MXN",
  myRole: "owner",
  placeCount: 0,
};

const MEMBERS: OrgMember[] = [
  { managerId: "me", name: null, email: "pato@canzeco.com", role: "owner" },
  { managerId: "m2", name: "Ana Ruiz", email: "ana@x.mx", role: "editor" },
];

function render(over: Partial<Parameters<typeof OrgScreenSections>[0]> = {}) {
  return renderToStaticMarkup(
    <OrgScreenSections
      org={ORG}
      myManagerId="me"
      account={null}
      orphaned={false}
      members={MEMBERS}
      pendingInvites={[]}
      membersError={null}
      {...over}
    />,
  );
}

describe("the five-box composition", () => {
  it("pins the approved order constant", () => {
    expect(ORG_SCREEN_ORDER).toEqual([
      "stripe",
      "members",
      "places",
      "credits",
      "capital",
      "activity",
    ]);
  });

  it("renders the boxes in that order", () => {
    const html = render();
    const positions = [
      "Stripe Account",
      "Members",
      "Places",
      SOON_STRIPS.credits.title,
      SOON_STRIPS.capital.title,
      SOON_STRIPS.activity.title,
    ].map((t) => html.indexOf(t));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("keeps the Soon strips honest: dashed, one line, no knobs", () => {
    const html = render();
    expect(html.match(/border-dashed/g)?.length).toBe(3);
    expect(html).toContain(SOON_STRIPS.capital.line);
    // Capital copy stays neutral — no product mechanics (founder-review law).
    expect(SOON_STRIPS.capital.line).not.toMatch(/advance|loan|rate|%/i);
    expect(html).toContain(SOON_STRIPS.activity.line);
  });

  it("promotes email to the primary line when the name is null, and tags You", () => {
    const html = render();
    expect(html).toContain("pato@canzeco.com");
    expect(html).toContain("Ana Ruiz");
    expect(html).toContain(">You<");
  });

  it("members failure renders the inline line, never an empty list, and hides Add", () => {
    const html = render({ members: [], membersError: "Couldn't load members." });
    expect(html).toContain("Couldn&#x27;t load members.");
    expect(html).not.toContain("Add member");
  });

  it("lists pending invites separately, with their own eyebrow (MESITA-1550)", () => {
    const invites: PendingOrgInvite[] = [
      {
        id: "inv-1",
        email: "new@x.mx",
        role: "editor",
        createdAt: "2026-09-06T00:00:00.000Z",
        expiresAt: "2026-09-20T00:00:00.000Z",
      },
    ];
    const html = render({ pendingInvites: invites });
    expect(html).toContain("Pending invites");
    expect(html).toContain("new@x.mx");
    expect(html).toContain("Invited, pending");
  });

  it("renders no pending-invites eyebrow when there are none", () => {
    const html = render();
    expect(html).not.toContain("Pending invites");
  });

  it("cashes the prefill promise when legal name is missing and no account exists", () => {
    const html = render();
    expect(html).toContain("comes prefilled");
    // …and drops the nudge once the org HAS a legal name: the line still
    // names what Stripe collects, but stops pointing at a filled-in field.
    const named = render({ org: { ...ORG, legalName: "Tacos SA de CV" } });
    expect(named).toContain("RFC, address, bank account");
    expect(named).not.toContain("comes prefilled");
  });

  it("gates connect on country AND legal entity, and sends the rest to Stripe", () => {
    // Pato, 2026-09-06: ask country + entity type BEFORE onboarding opens;
    // the RFC and everything after it belong to Stripe's hosted flow.
    const html = render();
    expect(html).toContain('name="country"');
    expect(html).toContain('name="entityType"');
    expect(html).toContain('value="individual"');
    expect(html).toContain('value="company"');
    // No valid default on the entity select — a silent "individual" sends a
    // persona moral down a branch that costs a restart, not a correction.
    expect(html).toMatch(/name="entityType"[^>]*required/);
    expect(html).toContain('<option value="" disabled="" selected="">');
    // The console asks two questions and names Stripe as the owner of the rest.
    expect(html).toContain("RFC, address, bank account");
    // Resume carries no entity gate — that account already has its answer.
    expect(html).toContain('name="intent" value="create"');
  });

  it("keeps the pre-connect caption and swaps it once an account exists", () => {
    expect(render()).toContain("saved for facturación");
    const withAccount: PaymentAccount = {
      organization_id: "org-1",
      stripe_account_id: "acct_1",
      livemode: false,
      charges_enabled: false,
      details_submitted: false,
      payouts_enabled: false,
      requirements_due: [],
      disabled_reason: null,
      country: "MX",
    };
    const html = render({ account: withAccount });
    expect(html).toContain("master for legal identity");
    expect(html).not.toContain("saved for facturación");
  });
});
