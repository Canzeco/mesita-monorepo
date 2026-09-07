// Pins the badge/headline/bullet copy and the aside's breakpoint contract —
// the things a careless future edit could silently drift (autoplan eng
// review, 2026-09-06, MESITA-1607). No test suite exists for this component
// family anywhere in the fleet (admin's and consumer's own EnterpriseAuthLayout
// have none either); this is the first, matching org-screen-sections.test.tsx's
// renderToStaticMarkup idiom since apps/web-business's vitest runs in
// environment: "node" (no jsdom/testing-library in this package).
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnterpriseAuthLayout } from "./EnterpriseAuthLayout";

function render() {
  return renderToStaticMarkup(
    <EnterpriseAuthLayout title="Mesita for business" subtitle="Sign in to manage a place.">
      <div>form goes here</div>
    </EnterpriseAuthLayout>,
  );
}

describe("business EnterpriseAuthLayout", () => {
  it("shows the Business badge, not a repeated Mesita eyebrow", () => {
    const html = render();
    expect(html).toContain(">Business<");
    // Admin's template has a "Mesita" eyebrow above the title; business's
    // title already says "Mesita for business", so this component drops it
    // to avoid the redundant brand-name repeat (design review finding).
    expect(html).not.toContain(">Mesita<");
  });

  it("renders the locked headline, not admin's or consumer's copy", () => {
    const html = render();
    expect(html).toContain("The console for your place.");
  });

  it("renders all four bullets in order", () => {
    const html = render();
    const positions = [
      "Verified, not just claimed",
      "Payouts through Stripe Connect",
      "One console per place",
      "Owners, editors, viewers",
    ].map((t) => html.indexOf(t));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("hides the aside below the lg breakpoint (accepted mobile-logo tradeoff)", () => {
    const html = render();
    expect(html).toMatch(/<aside class="[^"]*\bhidden\b[^"]*\blg:flex\b[^"]*"/);
  });

  it("uses the solid bg-foreground/text-background pair, not a gradient token", () => {
    const html = render();
    expect(html).toMatch(/<aside class="[^"]*\bbg-foreground\b[^"]*\btext-background\b[^"]*"/);
    expect(html).not.toMatch(/bg-primary|bg-brand|bg-hero/);
  });

  it("renders the chip slot when passed", () => {
    const html = renderToStaticMarkup(
      <EnterpriseAuthLayout
        title="Mesita for business"
        subtitle="Sign in to manage a place."
        chip={<p>Google sign-in failed.</p>}
      >
        <div />
      </EnterpriseAuthLayout>,
    );
    expect(html).toContain("Google sign-in failed.");
  });
});
