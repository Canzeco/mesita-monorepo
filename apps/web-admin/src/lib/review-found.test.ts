import { describe, expect, it } from "vitest";
import { mergeReviewFoundFlags, reviewFoundFlags } from "./review-found";

describe("reviewFoundFlags", () => {
  it("only treats true as found", () => {
    expect(reviewFoundFlags({ google_found: true, instagram_found: 1 })).toEqual({
      google_found: true,
      instagram_found: false,
      facebook_found: false,
    });
  });
});

describe("mergeReviewFoundFlags", () => {
  it("keeps prior values when the patch omits booleans", () => {
    expect(
      mergeReviewFoundFlags(
        { google_found: true, instagram_found: false, facebook_found: true },
        { google_found: undefined },
      ),
    ).toEqual({ google_found: true, instagram_found: false, facebook_found: true });
  });

  it("overrides when the patch sends a boolean", () => {
    expect(
      mergeReviewFoundFlags(
        { google_found: true, instagram_found: false, facebook_found: true },
        { instagram_found: true },
      ),
    ).toEqual({ google_found: true, instagram_found: true, facebook_found: true });
  });
});
