import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const shell = readFileSync(join(here, "AppShell.tsx"), "utf8");
const rail = readFileSync(join(here, "Sidebar.tsx"), "utf8");
// Comments stripped: the prose in these files NAMES the classes it bans, and a
// raw scan would read the explanation as the mistake.
const code = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");

// The frame is the one box every console page sits in, and the two ways it can
// break are both invisible until an operator hits them: it can disagree with
// the window (a measured height that went stale), or it can SCROLL ITSELF (an
// overflow:hidden box is still a scroll container, so a find-in-page hit or an
// autoFocus under a subtree that overflows drags rail and content up together
// and leaves dead space below — with no scrollbar to come back).
//
// Ported from web-admin's AppShell.test.ts, which had already paid for both.
describe("the console frame is pinned to the viewport and never scrolls", () => {
  it("is fixed inset-0, not a measured dvh box", () => {
    expect(shell).toContain('"fixed inset-0 flex overflow-clip"');
    expect(shell).not.toContain("h-dvh");
  });

  it("clips rather than hides, so the frame is not a scroll container", () => {
    expect(code(shell)).not.toContain("overflow-hidden");
  });

  it("lets the main column shrink, so it can never outgrow the frame", () => {
    expect(shell).toContain('"flex min-h-0 min-w-0 flex-1 flex-col"');
  });

  it("keeps main as the only scroller", () => {
    expect(shell).toContain(
      '<main className="flex-1 overflow-x-hidden overflow-y-auto">',
    );
  });
});

// The drawer is a modal. Admin's shipped without a trap, so Tab walked out of
// it and into the page behind the scrim, where a sighted keyboard user then
// operated controls they could not see. Not ported forward.
describe("the drawer is a real modal", () => {
  it("declares itself one", () => {
    expect(shell).toContain('role="dialog"');
    expect(shell).toContain('aria-modal="true"');
    expect(shell).toMatch(/aria-label="Console navigation"/);
  });

  it("traps Tab inside itself", () => {
    expect(shell).toContain('e.key !== "Tab"');
    expect(shell).toContain("last.focus()");
    expect(shell).toContain("first.focus()");
  });

  it("closes on Esc, on the backdrop, and on navigation", () => {
    expect(shell).toContain('e.key === "Escape"');
    expect(shell).toContain("onClick={close}");
    expect(shell).toContain("onNavigate={close}");
  });

  it("is INERT while closed, not merely translated out of view", () => {
    // The panel stays mounted so it can animate, and a closed one is hidden
    // only by a transform — which takes it out of view but NOT out of the tab
    // order. Without `inert`, a keyboard user below `lg` walks through a full
    // set of invisible nav links on every screen. It also legalises the
    // aria-hidden: hiding a subtree that still holds focusable nodes is
    // invalid ARIA on its own.
    expect(shell).toContain("inert={!open}");
    expect(shell).toContain("aria-hidden={!open}");
  });

  it("locks body scroll while open, and restores what it found", () => {
    // Restoring the PREVIOUS value, not hard-coding "": another component may
    // legitimately own the lock when this one lets go.
    expect(shell).toContain(
      "const prevOverflow = document.body.style.overflow",
    );
    expect(shell).toContain("document.body.style.overflow = prevOverflow");
  });
});

// MESITA-1710. The rail is light, and its contrast is a measured claim rather
// than an inherited one — admin's dark rail ships three AA failures
// (`text-background/35` eyebrows at ~3.3:1, `/45` collapse at 4.36:1) and this
// port must not carry them across.
describe("the rail is light, and every text token is a measured pair", () => {
  it("uses the sidebar token family, not an inversion", () => {
    expect(rail).toContain("bg-sidebar text-sidebar-foreground");
    expect(rail).not.toContain('bg-foreground text-background"');
  });

  it("never sets text on a bare opacity fraction", () => {
    // `text-background/35` and friends are how the failures got in: an alpha
    // on a text colour is a contrast ratio nobody computed. Semantic pairs
    // only. (An opacity on a decorative dot or a separator is fine.)
    expect(code(rail)).not.toMatch(/text-(background|foreground)\/\d+/);
  });

  it("the active row is a solid fill, so `you are here` survives a glance", () => {
    expect(rail).toContain('ROW_ACTIVE = "bg-foreground text-background');
  });

  it("marks the active row for assistive tech, not just visually", () => {
    expect(rail).toContain('aria-current={active ? "page" : undefined}');
  });

  it("keeps 44px touch targets below lg and tightens them above", () => {
    expect(rail).toContain("min-h-11");
    expect(rail).toContain("lg:min-h-0");
  });

  it("every chrome href comes from console-routes, never a path built inline", () => {
    // The organization is in the PATH now (MESITA-1807), so there is no
    // parameter to drop — but a raw path built inline still bypasses the
    // route contract, and `placeIdFromPathname` would still light the row
    // correctly while the link itself 404s. Every href is a contract call, or
    // a prop that its caller built from one.
    //
    // SCAN BOTH FILES. This assertion used to read `code(shell)` alone, so it
    // covered AppShell's single href and none of the rail's — the guard sat at
    // 1 of 8 and looked green the whole time. The rail is where the nav
    // actually lives, so it was the half that mattered.
    const SANCTIONED = [
      /^href=\{SHELL_ROUTES\./, // a fixed address
      /^href=\{orgHref\(/, // an organization page
      /^href=\{orgPlacesHref\(/, // the list
      /^href=\{orgPlacesNewHref\(/, // the Add place ceremony
      /^href=\{placeTabHref\(/, // a place view
      /^href=\{landingHref\}$/, // where / would land, resolved by AppShell
      /^href=\{href\}$/, // NavRow / CeremonyPlus / MenuLink prop pass-through: built by the caller
    ];
    const links = [
      ...(code(shell).match(/href=\{[^}]*\}/g) ?? []),
      ...(code(rail).match(/href=\{[^}]*\}/g) ?? []),
    ];
    // Vacuous-pass guard: a scan that finds nothing must fail, not pass. The
    // narrowing above was invisible precisely because an empty-ish list still
    // satisfied a `for` loop.
    expect(links.length).toBeGreaterThanOrEqual(4);
    for (const link of links) {
      expect(
        SANCTIONED.some((ok) => ok.test(link)),
        `${link} is not built from the route contract`,
      ).toBe(true);
    }
  });

  it("ignores Escape and Tab that a rail menu already handled", () => {
    // A picker's menu is portaled to body, outside the drawer, and Radix
    // handles Escape (and prevents Tab) on a document CAPTURE listener that
    // runs before this window handler. Without the guard one Esc closes the
    // menu AND the drawer.
    expect(shell).toContain("if (e.defaultPrevented) return;");
    expect(shell.indexOf("if (e.defaultPrevented) return;")).toBeLessThan(
      shell.indexOf('if (e.key === "Escape")'),
    );
  });

  it("resolves the scope once and remembers it in the two rail cookies", () => {
    expect(shell).toContain("useRailScope(");
    expect(shell).toContain("RAIL_ORG_COOKIE");
    expect(shell).toContain("RAIL_PLACE_COOKIE");
    // Only a place actually OPEN is remembered — the rail's fallback pick is
    // not a visit.
    expect(shell).toContain("scope.placeIsCurrent ? (scope.place?.id ?? null) : null");
  });

  it("labels the nav landmark", () => {
    expect(rail).toContain('aria-label="Console"');
  });

  it("uses TINY_LABEL_CLASS for the eyebrow, never a bare heading tag", () => {
    // globals.css puts every bare h1/h2/h3 on the display face, so a 10px
    // eyebrow written as an <h2> silently becomes a serif.
    expect(rail).toContain("TINY_LABEL_CLASS");
    expect(code(rail)).not.toMatch(/<h[123][\s>]/);
  });
});
