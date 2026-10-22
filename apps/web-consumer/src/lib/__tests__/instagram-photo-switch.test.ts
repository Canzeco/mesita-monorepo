// MVP test rule (MESITA-2600): only the data/EF contract guard stays; UI pins were removed (MESITA-2601).
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
  it("writes the server fact, not a device pref", () => {
    expect(MODAL).toContain("apiUpdateConsumerProfile(supabase, { use_instagram_photo: next })");
    expect(MODAL).not.toMatch(/localStorage|useStoredFlag/);
  });
});
