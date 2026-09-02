import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// THE APP IS ALWAYS 100% OF THE VISIBLE FRAME.
//
// MobileFrame is `h-dvh` and `max-w-md`: every screen is already sized to the
// viewport, so a zoom level other than 1 cannot reveal anything — it can only
// crop. The reported failure was a tap on the search input scaling the whole
// app, which left the Discover tab row bleeding off both edges and the fixed
// RouteBadge drifting over the chrome.
//
// This is a source-level guard on purpose: the behaviour needs a real engine
// with a real pinch and a real soft keyboard, which jsdom has neither of. What
// it CAN prove is that all three parts of the lock are still wired — each one
// covers an engine the other two do not, so a well-meaning cleanup that drops
// any single part looks harmless and silently reopens the bug.

const SRC = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

describe("the frame never zooms", () => {
  it("pins scale at 1 in the viewport export — Chrome, Android, desktop", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain("export const viewport");
    expect(layout).toContain("maximumScale: 1");
    expect(layout).toContain("minimumScale: 1");
    expect(layout).toContain("userScalable: false");
    // The keyboard fix shares this export and is unrelated to the zoom lock;
    // pin it here too so neither edit can quietly drop the other.
    expect(layout).toContain('interactiveWidget: "resizes-content"');
  });

  it("refuses Safari's gesture events, which is where the meta is ignored", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain("<ViewportLock />");

    const lock = read("components/consumer/ViewportLock.tsx");
    // All THREE: Safari re-fires the zoom on gesturechange, so refusing only
    // gesturestart still lets a sustained pinch through.
    expect(lock).toContain('"gesturestart"');
    expect(lock).toContain('"gesturechange"');
    expect(lock).toContain('"gestureend"');
    expect(lock).toContain("event.preventDefault()");
    // A passive listener CANNOT preventDefault, and Safari defaults
    // touch-family listeners on document to passive. Without this the
    // component is a no-op that still looks correct.
    expect(lock).toContain("{ passive: false }");
  });

  it("floors touch form controls at 16px — the CAUSE, not the gesture", () => {
    const css = read("app/globals.css");
    // Below 16px iOS zooms the page on focus and no viewport meta stops it.
    expect(css).toContain("@media (hover: none) and (pointer: coarse)");
    expect(css).toMatch(/textarea\s*\{\s*font-size:\s*1rem;/);
    // The floor must stay OUTSIDE @layer: layer order beats specificity, so a
    // `text-sm` utility wins over anything written inside @layer base.
    const floorAt = css.indexOf("@media (hover: none) and (pointer: coarse)");
    expect(floorAt).toBeGreaterThan(-1);
    expect(css.slice(floorAt)).not.toContain("@layer");
    // A floor that shrinks the fields already above it is not a floor.
    expect(css).toContain('[data-field-size="lg"]');
    expect(read("components/auth/PhoneOtpForm.tsx")).toContain(
      'data-field-size="lg"',
    );
    expect(read("components/consumer/me/InvitePinModal.tsx")).toContain(
      'data-field-size="lg"',
    );
  });

  it("kills double-tap zoom and sideways pan without touching the map", () => {
    const css = read("app/globals.css");
    // `manipulation`, NOT `none`/`pan-x pan-y`: the map needs the pinch
    // touches to reach its own handler. touch-action only ever narrows, so
    // SwipeDeck's `touch-none` still wins where it is set.
    expect(css).toContain("touch-action: manipulation");
    expect(css).not.toContain("touch-action: none");
    // `clip`, not `hidden` — `hidden` makes a scroll container and kills
    // `position: sticky` in every descendant.
    expect(css).toContain("overflow-x: clip");
    expect(css).toContain("overscroll-behavior-x: none");
    expect(css).toContain("text-size-adjust: 100%");
  });
});
