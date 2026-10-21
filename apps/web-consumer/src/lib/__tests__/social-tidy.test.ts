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
    expect(src).toContain('{refreshing ? "Refreshing…" : "Refresh"}');
    expect(src).toContain("data-social-refresh");
    expect(src).toContain('refreshing && "animate-spin"');
    expect(src).toContain('{feed.sample ? "Sample activity" : "Near you"}');
    expect(src).toContain("export const FRESH_MS = 4_000;");
    expect(src).toContain('fresh && "bg-muted"');
    // The first load glows nothing; the sample never glows.
    expect(src).toContain("const arrived = seen ? keys.filter((k) => !seen.has(k)) : [];");
    expect(src).toContain("fresh={!feed.sample && fresh.has(eventKey(item))}");
  });

  // MESITA-2536: level 1 — the "N new" pill, pull to refresh, seen marking.
  it("shows an N new pill when scrolled down, pulls to refresh, marks what it shows", () => {
    expect(src).toContain("data-social-new-pill");
    expect(src).toContain("{pendingNew} new");
    expect(src).toContain("if (arrived.length > 0 && !atTopRef.current) {");
    expect(src).toContain('scroller()?.scrollTo({ top: 0, behavior: "smooth" });');
    expect(src).toContain("if (top) setPendingNew(0);");
    expect(src).toContain("export const PULL_TRIGGER = 56;");
    expect(src).toContain("if (pull >= PULL_TRIGGER && !refreshing) refresh();");
    expect(src).toContain("data-social-pull");
    expect(src).toContain("markSocialSeen(items[0]?.at);");
  });

  // MESITA-2540: one box — the rows in a white card on grey, Refresh centred.
  it("sits in one white card on a grey pane, with Refresh centred above it", () => {
    expect(src).toContain('className="bg-muted flex-1 pb-6"');
    expect(src).toContain(
      'className="divide-border border-border bg-card mx-3 divide-y overflow-hidden rounded-2xl border"',
    );
    expect(src).toContain('<div className="flex justify-center pt-3 pb-2">');
    expect(src).not.toContain('aria-label="Refresh"');
  });

  it("an error offers Try again", () => {
    expect(src).toContain('label: "Try again"');
  });
});
