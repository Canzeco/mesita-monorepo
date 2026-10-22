import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Pato, MESITA-2599: connect by DM asks for the @handle first — "it's a
// clearer UX" — though the bot verifies whoever sends the code.
const MODAL = readFileSync(
  join(__dirname, "../../components/consumer/me/InstagramModal.tsx"),
  "utf8",
);
const DM = MODAL.slice(
  MODAL.indexOf("function ConnectByMessage"),
  MODAL.indexOf("function ConnectModule"),
);

describe("Connect Instagram by DM", () => {
  it("asks for the @handle first, then the code, then sends it to the bot", () => {
    expect(DM).toContain("Type your Instagram @handle");
    expect(DM).toContain("data-instagram-dm-handle");
    expect(DM.indexOf("Type your Instagram @handle")).toBeLessThan(
      DM.indexOf("Send your code to"),
    );
  });

  it("gives no code until the handle is a real Instagram username", () => {
    expect(DM).toContain("disabled={busy || !handleOk}");
    expect(DM).toContain("if (busy || !handleOk) return;");
  });

  it("names the account to send from, and sends no handle to the server", () => {
    expect(DM).toContain("Send this code from");
    expect(DM).toContain("apiStartInstagramDm(supabase)");
    expect(DM).not.toMatch(/apiStartInstagramDm\(supabase,/);
  });
});
