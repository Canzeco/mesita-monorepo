// What the owner reads at each step (MESITA-1645). Every assertion answers
// one question: after reading this, do they know whose move it is?
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { StatePill, disabledReasonCopy } from "./badges";
import {
  canOpenDashboard,
  canRestartOnboarding,
  canResumeOnboarding,
  paymentAccountState,
  type PaymentAccount,
} from "@/lib/api/console";
import { ConnectReturnNotice } from "./ConnectReturnNotice";

const CARD = readFileSync(path.join(__dirname, "./PaymentsCard.tsx"), "utf8");

function account(over: Partial<PaymentAccount> = {}): PaymentAccount {
  return {
    place_id: "p-1",
    stripe_account_id: "acct_1",
    livemode: false,
    charges_enabled: false,
    details_submitted: false,
    payouts_enabled: false,
    requirements_due: [],
    disabled_reason: null,
    country: "MX",
    ...over,
  };
}

describe("one word no longer means two opposite things", () => {
  it("never started is UNFINISHED — the owner's move", () => {
    expect(paymentAccountState(account(), false)).toBe("unfinished");
  });

  it("submitted with nothing outstanding is IN_REVIEW — Stripe's move", () => {
    expect(
      paymentAccountState(account({ details_submitted: true }), false),
    ).toBe("in_review");
  });

  it("submitted but Stripe came back asking is UNFINISHED again", () => {
    expect(
      paymentAccountState(
        account({ details_submitted: true, requirements_due: ["id_document"] }),
        false,
      ),
    ).toBe("unfinished");
  });

  it("charge capability outranks everything below it", () => {
    expect(
      paymentAccountState(
        account({ charges_enabled: true, payouts_enabled: true }),
        false,
      ),
    ).toBe("live");
    expect(
      paymentAccountState(account({ charges_enabled: true }), false),
    ).toBe("charges_only");
  });

  it("says whose move it is, in words", () => {
    expect(renderToStaticMarkup(<StatePill state="unfinished" />)).toContain(
      "Not finished",
    );
    expect(renderToStaticMarkup(<StatePill state="in_review" />)).toContain(
      "Stripe is checking",
    );
  });

  it("does not paint waiting as a debt", () => {
    // Amber means "you owe something". Waiting on Stripe is not that.
    expect(renderToStaticMarkup(<StatePill state="unfinished" />)).toContain("amber");
    expect(renderToStaticMarkup(<StatePill state="in_review" />)).not.toContain("amber");
  });

  it("offers Resume on the owner's move and NOT on Stripe's", () => {
    // The loop this closes: a button that reopened a form already completed.
    expect(canResumeOnboarding(account({ details_submitted: true }), false)).toBe(
      false,
    );
    expect(CARD).toContain("{resumable && (");
    expect(CARD).not.toContain("!account?.details_submitted && (");
  });
});

describe("an abandoned onboarding is not a dead end (MESITA-1865)", () => {
  // Stripe sets requirements.disabled_reason the moment capabilities are
  // requested and unmet, so THIS is what every owner who closed the Stripe tab
  // comes back to. It used to read Restricted, and Restricted has no way in.
  const abandoned = account({ disabled_reason: "requirements.past_due" });

  it("day-zero past_due is UNFINISHED, not Restricted", () => {
    expect(paymentAccountState(abandoned, false)).toBe("unfinished");
    expect(canResumeOnboarding(abandoned, false)).toBe(true);
  });

  it("a closed account stays Restricted and is offered nothing", () => {
    for (const reason of ["rejected.fraud", "platform_paused"]) {
      const dead = account({ disabled_reason: reason });
      expect(paymentAccountState(dead, false)).toBe("restricted");
      expect(canResumeOnboarding(dead, false)).toBe(false);
      expect(canRestartOnboarding(dead, false)).toBe(false);
    }
  });

  it("a submitted account with a live reason is still Restricted", () => {
    // The ordering fix must not swallow a genuine restriction on an account
    // that finished: submission outranks the reason, having nothing due does
    // not.
    expect(
      paymentAccountState(
        account({
          details_submitted: true,
          disabled_reason: "requirements.pending_verification",
        }),
        false,
      ),
    ).toBe("restricted");
  });

  it("never offers a dashboard that cannot exist yet", () => {
    // createLoginLink FAILS before hosted onboarding completes, and the EF
    // reported that refusal as a Mesita misconfiguration.
    expect(canOpenDashboard(abandoned, false)).toBe(false);
    expect(canOpenDashboard(account({ details_submitted: true }), false)).toBe(
      true,
    );
    expect(CARD).toContain("{dashboardReady && (");
  });

  it("Start over is offered ONLY before anything was submitted or charged", () => {
    expect(canRestartOnboarding(abandoned, false)).toBe(true);
    expect(
      canRestartOnboarding(account({ details_submitted: true }), false),
    ).toBe(false);
    expect(
      canRestartOnboarding(account({ charges_enabled: true }), false),
    ).toBe(false);
    // An orphaned row has Connect again on the pill row; Start over would be
    // a second door to the same place.
    expect(canRestartOnboarding(abandoned, true)).toBe(false);
  });

  it("Start over reopens the two permanent answers, marked as a restart", () => {
    expect(CARD).toContain('setConnectOpen("restart")');
    expect(CARD).toContain('name="intent" value={intent}');
  });

  it("an account with no door at all renders no action block", () => {
    // A rejected account used to get a lone dashboard button that 503ed.
    expect(CARD).toContain("(resumable || dashboardReady || restartable)");
  });
});

describe("no Stripe vocabulary reaches the restaurant", () => {
  it("maps disabled_reason instead of printing the enum", () => {
    expect(disabledReasonCopy("requirements.past_due")).not.toContain("requirements");
    expect(disabledReasonCopy("rejected.fraud")).not.toMatch(/fraud|rejected/);
    // An accusation is not a badge — it routes to a person.
    expect(disabledReasonCopy("rejected.fraud")).toMatch(/write to us/i);
  });

  it("defaults an UNKNOWN reason to ours, not Stripe's", () => {
    const copy = disabledReasonCopy("some_reason_invented_in_2027");
    expect(copy).not.toContain("2027");
    expect(copy).toMatch(/write to us/i);
  });

  it("the card never renders the raw field", () => {
    expect(CARD).not.toMatch(/\{account\??\.disabled_reason/);
    expect(CARD).toContain("disabledReasonCopy(");
  });
});

describe("the error is where the eye is", () => {
  it("each form owns its own message, titled and announced", () => {
    expect(CARD).toContain('role="alert"');
    expect(CARD).toContain("Couldn't connect payments");
    expect(CARD).toContain("Couldn't open the Stripe dashboard");
    // The shared slot that made two different failures look identical.
    expect(CARD).not.toContain("connectState.error ?? dashState.error");
  });
});

describe("coming back from Stripe says something", () => {
  it("acknowledges a return", () => {
    const html = renderToStaticMarkup(<ConnectReturnNotice connect="return" />);
    expect(html).toMatch(/checking it/);
  });

  it("tells an expired link what to press", () => {
    const html = renderToStaticMarkup(<ConnectReturnNotice connect="refresh" />);
    expect(html).toMatch(/Resume onboarding/);
    expect(html).toMatch(/nothing you already sent was lost/i);
  });

  it("renders nothing when the owner did not come from Stripe", () => {
    expect(renderToStaticMarkup(<ConnectReturnNotice />)).toBe("");
    expect(renderToStaticMarkup(<ConnectReturnNotice connect="wat" />)).toBe("");
  });
});
