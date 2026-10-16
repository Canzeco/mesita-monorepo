import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boxesAfterFailedSync, reviewBoxState, syncSubtitle } from "./ReviewsSummary";

describe("review boxes", () => {
  it("names the five states from the saved link and the last sync", () => {
    expect(reviewBoxState(false, undefined)).toBe("no-link");
    expect(reviewBoxState(true, undefined)).toBe("never-synced");
    expect(reviewBoxState(true, "synced")).toBe("synced");
    expect(reviewBoxState(true, "error")).toBe("error");
    expect(reviewBoxState(false, "synced")).toBe("no-link");
  });

  it("says when the last sync happened, or that it never has", () => {
    expect(syncSubtitle({ syncedAt: null, failures: [], syncing: false })).toBe("Never synced");
    expect(syncSubtitle({ syncedAt: null, failures: [], syncing: true })).toBe("Syncing…");
    expect(syncSubtitle({
      syncedAt: "2026-10-15T00:00:00Z",
      failures: ["instagram"],
      syncing: false,
    })).toBe("instagram failed.");
    expect(syncSubtitle({
      syncedAt: "2026-10-15T00:00:00Z",
      failures: ["instagram", "facebook", "google_reviews"],
      syncing: false,
      errors: {
        instagram: "Apify refused the call: too many outstanding invoices.",
        facebook: "Apify refused the call: too many outstanding invoices.",
        google_reviews: "Apify refused the call: too many outstanding invoices.",
      },
    })).toBe("Apify refused the call: too many outstanding invoices.");
  });

  it("turns tiles that were still syncing into errors when the call fails", () => {
    expect(boxesAfterFailedSync({
      google: "syncing",
      instagram: "no-link",
      facebook: "syncing",
      google_reviews: "syncing",
    })).toEqual({
      google: "error",
      instagram: "no-link",
      facebook: "error",
      google_reviews: "error",
    });
  });

  it("keeps Sync in the Reviews header and the four boxes", () => {
    const src = readFileSync(join(__dirname, "ReviewsSummary.tsx"), "utf8");
    expect(src).toMatch(/\n\s+Sync\n/);
    expect(src).toContain("Google Summary");
    expect(src).toContain("Instagram Summary");
    expect(src).toContain("Facebook Summary");
    expect(src).toContain("Google Reviews");
    expect(src).not.toContain("instagram_found");
    expect(src).not.toContain("apify");
  });
});
