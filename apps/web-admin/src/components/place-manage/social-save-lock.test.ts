import { describe, expect, it } from "vitest";
import { socialSaveLocked } from "./social-save-lock";

describe("socialSaveLocked", () => {
  const draft = {
    instagram_url: "https://instagram.com/gone",
    facebook_url: "https://facebook.com/page",
  };

  it("stays locked while the dead link is unchanged", () => {
    expect(
      socialSaveLocked({ instagram_url: draft.instagram_url }, draft),
    ).toBe(true);
  });

  it("unlocks when that link is edited", () => {
    expect(
      socialSaveLocked(
        { instagram_url: draft.instagram_url },
        { ...draft, instagram_url: "https://instagram.com/strana" },
      ),
    ).toBe(false);
  });

  it("does not lock a save that never missed", () => {
    expect(socialSaveLocked(null, draft)).toBe(false);
    expect(socialSaveLocked({}, draft)).toBe(false);
  });

  it("keeps the lock when only the other channel changes", () => {
    expect(
      socialSaveLocked(
        { facebook_url: draft.facebook_url },
        { ...draft, instagram_url: "https://instagram.com/other" },
      ),
    ).toBe(true);
  });
});
