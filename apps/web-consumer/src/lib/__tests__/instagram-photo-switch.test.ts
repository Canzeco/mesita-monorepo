import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Pato, MESITA-2585: the Instagram photo is the default, but the guest is
// asked and can switch it off ("we only get the username and the
// [followers]").
const MODAL = readFileSync(
  join(__dirname, "../../components/consumer/me/InstagramModal.tsx"),
  "utf8",
);

describe("Me › Instagram: Use my Instagram photo", () => {
  it("is a switch on the connect screen, on unless the guest said no", () => {
    expect(MODAL).toContain("<InstagramPhotoSwitch />");
    expect(MODAL).toContain('role="switch"');
    expect(MODAL).toContain("Use my Instagram photo");
    expect(MODAL).toContain("consumer.use_instagram_photo !== false");
  });

  it("writes the server fact, not a device pref", () => {
    expect(MODAL).toContain("apiUpdateConsumerProfile(supabase, { use_instagram_photo: next })");
    expect(MODAL).not.toMatch(/localStorage|useStoredFlag/);
  });

  it("says what off means", () => {
    expect(MODAL).toContain("Only your username and followers");
  });
});
