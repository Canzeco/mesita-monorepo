import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Social's tidy notifications (MESITA-2525, Pato: "make this more UI
// friendly … your call"): a verb badge on the face, the time on the quiet
// line, and a placeholder where a place has no photo. ONE PLAIN LIST, no
// day headings (MESITA-2528, Pato: "Just the fucking plain list with time
// notation. Keep it simple.").

describe("the row", () => {
  const src = readFileSync(
    join(__dirname, "../../components/consumer/home/SocialFeed.tsx"),
    "utf8",
  );

  it("wears the verb as a badge: heart liked, pin visited, eye viewed", () => {
    expect(src).toMatch(/saved: Heart,\s+went: MapPin,\s+viewed: Eye,/);
    expect(src).toContain("data-social-verb={kind}");
  });

  it("never draws an empty photo box: no photo → the card placeholder", () => {
    expect(src).toContain("placePlaceholder(place)");
    expect(src).toContain("<FamilyIcon");
    // The old row drew `{photo ? <img/> : null}` inside the tile.
    expect(src).not.toMatch(/\{photo \? \([\s\S]{0,200}\) : null\}/);
  });

  it("puts the time on the quiet line, not after the place", () => {
    expect(src).not.toContain("{item.place.name}</span>.");
    expect(src).toContain("data-social-quiet");
  });

  it("is one plain list: no day headings", () => {
    expect(src).not.toMatch(/Today|Yesterday|This week|Earlier/);
    expect(src).not.toContain("feedSections");
    expect(src).toMatch(/<ul\s+role="list"\s+aria-label="Social"/);
  });

  it("never counts others, and stays live while the tab is in view", () => {
    expect(src).not.toContain(".others");
    expect(src).not.toContain("feedVerbPhrase");
    expect(src).toContain("export const LIVE_MS = 30_000;");
    expect(src).toContain('document.visibilityState === "visible"');
    expect(src).toContain("window.clearInterval(timer)");
  });

  // MESITA-2535: a notification stream — a refresh button, new rows glow.
  it("has a refresh button in a header row and lets new rows glow in", () => {
    // MESITA-2543: no button — "Updated just now · Refresh", the word the
    // tap target; "Refreshing…" while it loads.
    expect(src).toContain("data-social-refresh");
    expect(src).toContain("data-social-status");
    expect(src).toContain("Refreshing…");
    expect(src).toContain("{feedStatus(feed.sample, updatedAt, now)}");
    expect(src).toContain("export const FRESH_MS = 4_000;");
    expect(src).toContain('fresh && "bg-muted"');
    // The first load glows nothing; the sample never glows.
    expect(src).toContain(
      "const arrived = seen ? keys.filter((k) => !seen.has(k)) : [];",
    );
    expect(src).toContain("fresh={!feed.sample && fresh.has(eventKey(item))}");
  });

  // MESITA-2536: level 1 — the "N new" pill, pull to refresh, seen marking.
  it("shows an N new pill when scrolled down, pulls to refresh, marks what it shows", () => {
    expect(src).toContain("data-social-new-pill");
    expect(src).toContain("{pendingNew} new");
    expect(src).toContain("if (arrived.length > 0 && !atTopRef.current) {");
    expect(src).toContain(
      'scroller()?.scrollTo({ top: 0, behavior: "smooth" });',
    );
    expect(src).toContain("if (top) setPendingNew(0);");
    expect(src).toContain("export const PULL_TRIGGER = 56;");
    expect(src).toContain(
      "if (pull >= PULL_TRIGGER && !refreshing) refresh();",
    );
    expect(src).toContain("data-social-pull");
    expect(src).toContain("markSocialSeen(items[0]?.at);");
  });

  // MESITA-2540: one box — the rows in a white card on grey, Refresh centred.
  it("sits in one white edge-to-edge band on a grey pane, with Refresh centred above it", () => {
    expect(src).toContain('className="bg-muted flex-1 pb-6"');
    expect(src).toContain(
      'className="divide-border border-border bg-card divide-y border-y"',
    );
    // Edge to edge, an endless feed: no side borders, no rounded card
    // (MESITA-2542).
    expect(src).not.toContain("rounded-2xl");
    expect(src).not.toContain("mx-3");
    // No pill: the stock-button look is gone (MESITA-2543).
    expect(src).not.toContain(
      '<div className="flex justify-center pt-3 pb-2">',
    );
    expect(src).not.toContain("rounded-full border px-4");
    expect(src).not.toContain('aria-label="Refresh"');
  });

  // MESITA-2542: the person or the place, never both.
  it("splits a row: the person opens their sheet here, the place opens its profile", () => {
    // No link wraps the whole row any more.
    expect(src).toContain("data-social-row\n");
    expect(src).not.toMatch(/<Link[^>]*\n\s*[^>]*data-social-row/);
    expect(src).toContain("onClick={() => onPerson(item)}");
    expect(src).toContain("data-social-person");
    expect(src).toContain("data-social-place");
    // A centred floating card that appears at once (MESITA-2546), never a
    // bottom sheet.
    expect(src).toMatch(/<LocalDialog[\s\S]{0,120}instant\s*>/);
    expect(src).not.toContain("<LocalSheet");
    expect(src).toContain("data-social-person-card");
    // The card is the member's identity card, no activity list
    // (MESITA-2547).
    expect(src).not.toContain("Recent activity");
    expect(src).toContain("<IdentityCard");
    // No member id ever reaches the client (MESITA-2460).
    expect(src).not.toContain("consumer_id");
  });

  // MESITA-2544: a span inside the place link or the person button is
  // inline and drops its 44px size, so the photo rendered full size. The
  // boxes are block and their wrappers flex (a browser check measured the
  // thumbnail at 1600x1067 before, 44x44 after).
  it("keeps the face and the photo 44px inside their link and button", () => {
    expect(src).toContain(
      '<span className="relative block h-11 w-11 shrink-0">',
    );
    expect(src).toContain(
      '<span className="bg-muted block h-11 w-11 shrink-0 overflow-hidden rounded-md">',
    );
    expect(src).toContain(
      '"focus-visible:ring-ring flex shrink-0 rounded-md outline-none focus-visible:ring-2"',
    );
    expect(src).toContain(
      '"focus-visible:ring-ring flex shrink-0 rounded-full outline-none focus-visible:ring-2"',
    );
  });

  it("an error offers Try again", () => {
    expect(src).toContain('label: "Try again"');
  });
});
