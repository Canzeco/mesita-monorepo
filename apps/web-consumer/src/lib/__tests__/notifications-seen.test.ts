// MVP test rule (MESITA-2600): the data guard behind the Me tab's red dot.
// hasUnseen moved here from lib/social-seen.ts when Social's dot went
// (MESITA-4044).
import { describe, expect, it } from "vitest";

import { hasUnseen } from "@/lib/notifications-seen";

describe("hasUnseen", () => {
  it("is newer-than-seen; nothing seen and an event exists counts", () => {
    expect(hasUnseen("2026-10-20T10:00:00Z", "2026-10-20T09:00:00Z")).toBe(true);
    expect(hasUnseen("2026-10-20T09:00:00Z", "2026-10-20T09:00:00Z")).toBe(false);
    expect(hasUnseen("2026-10-20T08:00:00Z", "2026-10-20T09:00:00Z")).toBe(false);
    expect(hasUnseen("2026-10-20T08:00:00Z", null)).toBe(true);
    expect(hasUnseen(null, null)).toBe(false);
    expect(hasUnseen("garbage", null)).toBe(false);
  });
});
