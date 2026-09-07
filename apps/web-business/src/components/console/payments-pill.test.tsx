// The terminal state of Connect onboarding must not claim more than it can
// deliver (MESITA-1643). `paymentAccountState` returns `live` when Stripe says
// the ACCOUNT can charge; Mesita sending charges through it is a different
// fact, and it is not true yet.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { StatePill, CARD_PAYMENTS_LIVE, READY_CAPTION } from "./badges";

const SRC = readFileSync(path.join(__dirname, "./badges.tsx"), "utf8");

describe("the payments pill tells the truth about rung 3", () => {
  it("says Ready, not Live, while the charge path does not exist", () => {
    // The consumer ticket-payment endpoint still refuses the Mesita method
    // with a 410, so no charge can reach this account. A green "Live" after
    // eight minutes of KYC fails silently, days later.
    expect(CARD_PAYMENTS_LIVE).toBe(false);
    const html = renderToStaticMarkup(<StatePill state="live" />);
    expect(html).toContain("Ready");
    expect(html).not.toContain("Live");
  });

  it("is not green while it is not live", () => {
    const html = renderToStaticMarkup(<StatePill state="live" />);
    expect(html).not.toContain("emerald");
    expect(html).toContain("sky");
  });

  it("carries a caption saying what Ready costs the owner in waiting", () => {
    expect(READY_CAPTION).toBeTruthy();
    expect(READY_CAPTION).toMatch(/card payments go live/);
  });

  // The whole point of the flag is that rung 3 flips ONE thing. If a later
  // edit hardcodes the strings again, the flag stops meaning anything.
  it("routes label AND tone through the same flag, so rung 3 is one edit", () => {
    expect(SRC).toMatch(/live:\s*CARD_PAYMENTS_LIVE \? "Live" : "Ready"/);
    expect(SRC).toMatch(/live:\s*CARD_PAYMENTS_LIVE\s*$/m);
  });
});
