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
    expect(src).toContain('<ul role="list" aria-label="Social"');
  });

  it("an error offers Try again", () => {
    expect(src).toContain('label: "Try again"');
  });
});
