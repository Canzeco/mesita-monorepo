// MVP test rule (MESITA-2600): only the auth/privacy guard stays; UI pins were removed (MESITA-2601).
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

  it("never counts others, and stays live while the tab is in view", () => {
    expect(src).not.toContain(".others");
    expect(src).not.toContain("feedVerbPhrase");
    expect(src).toContain("export const LIVE_MS = 30_000;");
    expect(src).toContain('document.visibilityState === "visible"');
    expect(src).toContain("window.clearInterval(timer)");
  });

  it("never sends consumer_id to the client (MESITA-2460)", () => {
    // No member id ever reaches the client (MESITA-2460).
    expect(src).not.toContain("consumer_id");
  });
});
