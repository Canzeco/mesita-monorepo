// Pins the organization pages' compositions (MESITA-1807): Overview's
// standing rows and Soon strips, and Payments' notice → Stripe → Partner.
// Rendered with renderToStaticMarkup against stub props: the pages assemble
// data, these components own composition, and this file needs no server
// mocks.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ORG_OVERVIEW_ORDER, OrgSoon, OrgStanding, SOON_STRIPS } from "./OrgOverview";
import { PAYMENTS_ORDER, PaymentsSections } from "./PaymentsSections";
import { ConnectStripeForm } from "./PaymentsCard";
import type { Organization, PaymentAccount } from "@/lib/api/organizations";
import { orgHref, orgPlacesHref } from "@/lib/console-routes";

const ORG: Organization = {
  id: "org-1",
  name: "Test Org",
  legalName: null,
  rfc: null,
  currency: "MXN",
  myRole: "owner",
  placeCount: 0,
  places: [],
};

const READY: PaymentAccount = {
  organization_id: "org-1",
  stripe_account_id: "acct_1",
  livemode: false,
  charges_enabled: true,
  details_submitted: true,
  payouts_enabled: true,
  requirements_due: [],
  disabled_reason: null,
  country: "MX",
};

function standing(over: Partial<Parameters<typeof OrgStanding>[0]> = {}) {
  return renderToStaticMarkup(
    <OrgStanding
      org={ORG}
      account={null}
      memberCount={1}
      pendingCount={0}
      membersError={null}
      {...over}
    />,
  );
}

function payments(over: Partial<Parameters<typeof PaymentsSections>[0]> = {}) {
  return renderToStaticMarkup(
    <PaymentsSections org={ORG} account={null} orphaned={false} {...over} />,
  );
}

function connectForm(over: Partial<Parameters<typeof ConnectStripeForm>[0]> = {}) {
  return renderToStaticMarkup(
    <ConnectStripeForm
      orgId="org-1"
      action={() => {}}
      pending={false}
      error={null}
      {...over}
    />,
  );
}

describe("Overview", () => {
  it("pins the approved order constant", () => {
    expect(ORG_OVERVIEW_ORDER).toEqual(["standing", "credits", "capital", "activity"]);
  });

  it("every standing row is a door to its page, in the rail's order", () => {
    const html = standing();
    const positions = ["Payments", "Partner", "Members", "Places"].map((t) =>
      html.indexOf(t),
    );
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toContain(`href="${orgHref("org-1", "payments")}"`);
    expect(html).toContain(`href="${orgHref("org-1", "members")}"`);
    expect(html).toContain(`href="${orgPlacesHref("org-1")}"`);
  });

  it("names the connect state and the Partner switch honestly", () => {
    expect(standing()).toContain("Not connected");
    expect(standing({ account: READY })).toContain("Connected");
    expect(standing()).toContain(">Off<");
    expect(standing({ org: { ...ORG, partnered: true } })).toContain(">On<");
  });

  it("counts people and pending invites, and never invents zero members", () => {
    expect(standing({ memberCount: 3, pendingCount: 2 })).toContain(
      "3 members · 2 invites pending",
    );
    expect(standing({ memberCount: 1, pendingCount: 1 })).toContain(
      "1 member · 1 invite pending",
    );
    const failed = standing({ memberCount: 0, membersError: "Couldn't load members." });
    expect(failed).toContain("Couldn&#x27;t load members.");
    expect(failed).not.toContain("0 members");
  });

  it("zero places is a next step, not a data point", () => {
    expect(standing()).toContain("None yet — claim one");
    expect(standing({ org: { ...ORG, placeCount: 3 } })).toContain("3 held");
  });

  it("keeps the Soon strips honest: dashed, one line, no knobs", () => {
    const html = renderToStaticMarkup(<OrgSoon />);
    expect(html.match(/border-dashed/g)?.length).toBe(3);
    expect(html).toContain(SOON_STRIPS.capital.line);
    // Capital copy stays neutral — no product mechanics (founder-review law).
    expect(SOON_STRIPS.capital.line).not.toMatch(/advance|loan|rate|%/i);
    expect(html).toContain(SOON_STRIPS.activity.line);
  });
});

describe("Payments", () => {
  it("pins the approved order constant", () => {
    expect(PAYMENTS_ORDER).toEqual(["notice", "stripe", "partner"]);
  });

  it("renders the boxes in that order, the notice first when Stripe sent one", () => {
    const html = payments({ connect: "return" });
    const positions = ["Stripe has what you sent", "Stripe Account", "Partner"].map(
      (t) => html.indexOf(t),
    );
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(payments()).not.toContain("Stripe has what you sent");
  });

  it("labels the Partner switch Partner, never Not Partner or Patner", () => {
    const html = payments();
    expect(html).toContain("Partner");
    expect(html).not.toContain("Not Partner");
    expect(html).not.toContain("Patner");
  });

  it("locks Partner until Stripe is charge-ready", () => {
    const html = payments();
    expect(html).toContain("Needs a Ready Stripe account");
    expect(html).not.toContain('role="switch"');
  });

  it("offers the Partner switch once Stripe is Ready, and never when orphaned", () => {
    const html = payments({ account: READY });
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-label="Partner"');
    expect(html).not.toContain("Needs a Ready Stripe account");
    expect(payments({ account: READY, orphaned: true })).not.toContain(
      'role="switch"',
    );
  });

  it("names Mesita Pay, Visit Rewards and Accept Prepays when Partner is on", () => {
    const html = payments({
      account: READY,
      org: { ...ORG, partnered: true, mesitaPayEnabled: true },
    });
    expect(html).toContain("Mesita Pay");
    expect(html).toContain("Visit Rewards");
    expect(html).toContain("Accept Prepays");
  });

  it("offers ONE control on the card, and asks its questions in the modal", () => {
    // Pato, 2026-09-09: "Connect Stripe must simply be a clean box." The two
    // selects and their caveat paragraph used to sit open on a summary card
    // whose every other row is a label and a value.
    const html = payments();
    expect(html).toContain("Connect Stripe");
    expect(html).not.toContain("<select");
    // A closed modal has no DOM — the questions cannot leak back onto the card.
    expect(html).not.toContain("legal name, RFC, address, bank account");
  });

  it("gates connect on country AND legal entity, and sends the rest to Stripe", () => {
    // Pato, 2026-09-06: ask country + entity type BEFORE onboarding opens;
    // the RFC and everything after it belong to Stripe's hosted flow.
    const html = connectForm();
    expect(html).toContain('name="country"');
    expect(html).toContain('name="entityType"');
    expect(html).toContain('value="individual"');
    expect(html).toContain('value="company"');
    // No valid default on the entity select — a silent "individual" sends a
    // persona moral down a branch that costs a restart, not a correction.
    expect(html).toMatch(/name="entityType"[^>]*required/);
    expect(html).toContain('<option value="" disabled="" selected="">');
    // The console asks two questions and names Stripe as the owner of the rest.
    expect(html).toContain("legal name, RFC, address, bank account");
    // Resume carries no entity gate — that account already has its answer.
    expect(html).toContain('name="intent" value="create"');
  });

  it("does not preview legal identity on the Stripe Account card", () => {
    const html = payments();
    expect(html).not.toContain("Legal identity");
    expect(html).not.toContain("Legal name");
    expect(html).not.toContain("Add details");
  });
});
