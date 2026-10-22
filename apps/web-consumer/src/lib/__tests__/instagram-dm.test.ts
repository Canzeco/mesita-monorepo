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

  // MESITA-2602: the message flow is always the screen; the channel only
  // says whether it is live or a Soon preview. No bio-code screen.
  it("always draws the message flow, live only when the channel is dm", () => {
    expect(PAGE).toContain("apiInstagramChannel(supabase)");
    expect(PAGE).toContain('<ConnectByMessage live={channel.channel === "dm"} />');
    expect(PAGE).not.toContain("function ConnectModule");
    expect(PAGE).not.toMatch(/apiStartInstagramClaim|apiCheckInstagramClaim/);
  });

  it("is a Soon preview while the channel is off: no code is asked for", () => {
    const dm = PAGE.slice(PAGE.indexOf("function ConnectByMessage"), PAGE.indexOf("function CurrentConnectionCard"));
    expect(dm).toContain("disabled={busy || !handleOk || !live}");
    expect(dm).toContain("if (busy || !handleOk || !live) return;");
    expect(dm).toContain("Connecting by Instagram message opens soon.");
  });

  // MESITA-2599: the message path asks for the @handle (for a clearer flow;
  // the bot still verifies the sender), never for a bio edit.
  it("asks for the @handle, never for a bio edit, on the message path", () => {
    const dm = PAGE.slice(PAGE.indexOf("function ConnectByMessage"), PAGE.indexOf("function CurrentConnectionCard"));
    expect(dm).toContain("Send it on Instagram");
    expect(dm).toContain("claim.link");
    expect(dm).toContain("Type your Instagram @handle");
    expect(dm).not.toMatch(/\bbio\b|onHandleChange/);
  });
});
