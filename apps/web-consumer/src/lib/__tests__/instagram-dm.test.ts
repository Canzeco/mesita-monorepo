// MVP test rule (MESITA-2600): only the auth guard stays; UI pins were removed (MESITA-2601).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { dmVerified } from "@/lib/api/profile";

// Instagram by DM (MESITA-2575): the guest sends Mesita's Instagram their
// code; the page waits for the server to say the account was proved.
describe("connecting Instagram by message", () => {
  const issuedAt = "2026-10-21T22:00:00Z";

  it("lands only when the claim is spent and the proof is newer than the code", () => {
    expect(
      dmVerified({ pending: false, handle: "vale", verifiedAt: "2026-10-21T22:00:05Z" }, issuedAt),
    ).toBe(true);
    // Still waiting for the message.
    expect(
      dmVerified({ pending: true, handle: "vale", verifiedAt: "2026-10-21T22:00:05Z" }, issuedAt),
    ).toBe(false);
    // An older connection is not this one.
    expect(
      dmVerified({ pending: false, handle: "vale", verifiedAt: "2026-10-20T10:00:00Z" }, issuedAt),
    ).toBe(false);
    // The claim lapsed and nothing was proved.
    expect(dmVerified({ pending: false, handle: null, verifiedAt: null }, issuedAt)).toBe(false);
  });

  const PAGE = readFileSync(
    join(__dirname, "../../components/consumer/me/InstagramModal.tsx"),
    "utf8",
  );

  // MESITA-2602, MESITA-3001: the message flow draws only when the channel
  // is dm; off, the page asks for no code.
  it("asks for a code only when the channel is live", () => {
    expect(PAGE).toContain("apiInstagramChannel(supabase)");
    expect(PAGE).toMatch(/channel\.channel === "dm" \? \(\s*<ConnectByMessage \/>\s*\) : \(\s*<ConnectLookup\b/);
    expect(PAGE).not.toContain("function ConnectModule");
    expect(PAGE).not.toMatch(/apiStartInstagramClaim|apiCheckInstagramClaim/);
    // The off card connects by username (MESITA-3039), never by DM code.
    const off = PAGE.slice(PAGE.indexOf("function ConnectLookup"), PAGE.indexOf("export function ConnectCardSkeleton"));
    expect(off).not.toContain("apiStartInstagramDm");
  });
});
