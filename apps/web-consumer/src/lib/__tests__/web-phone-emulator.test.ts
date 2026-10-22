// MVP test rule (MESITA-2600): only the auth guard stays; UI pins were removed (MESITA-2601).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// /web IS THE PHONE EMULATOR (Pato, MESITA-2134: "make it kinda like a mobile
// emulator in web — fuck the sidebar menu").

const SRC = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

describe("/web is the phone emulator", () => {
  it("there is no anonymous-browse door left (MESITA-2137)", () => {
    for (const gone of [
      "components/consumer/DownloadAppScreen.tsx",
      "components/consumer/SurfaceSwitch.tsx",
      "lib/web-surface-auth.ts",
      "app/(shell)/get-the-app/page.tsx",
    ]) {
      expect(existsSync(join(SRC, gone)), gone).toBe(false);
    }
    expect(read("lib/supabase/middleware.ts")).not.toContain(
      "signInAnonymously(",
    );
  });
});
