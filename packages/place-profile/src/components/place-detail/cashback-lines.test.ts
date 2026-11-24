// MESITA-4766: the Pay tab's lines and its "You" mark. Money: the row a
// guest reads as theirs must be the server's `line`, never a guess.
import { describe, expect, it } from "vitest";

import type { PlaceCashback } from "../../place-detail";
import { cashbackRows, youLine } from "./vouchers";

const all = (line: PlaceCashback["line"]): PlaceCashback => ({ welcome_bps: 1000, returning_bps: 500, returning_vip_bps: 2000, welcome_vip_bps: 2000, line });

describe("cashback lines (MESITA-4766)", () => {
  it("lists the four tiers in Pato's order (MESITA-4789) and hides a 0% line", () => {
    expect(cashbackRows(all(null)).map((r) => r.line)).toEqual(["welcome", "returning", "welcome_vip", "returning_vip"]);
    expect(cashbackRows({ ...all(null), returning_vip_bps: 0, welcome_vip_bps: 0 }).map((r) => r.line)).toEqual(["welcome", "returning"]);
    expect(cashbackRows({ welcome_bps: 0, returning_bps: 0, returning_vip_bps: 0, welcome_vip_bps: 0, line: "welcome" })).toEqual([]);
  });

  it("marks You from the server's line, and nothing signed out or on a 0% line", () => {
    expect(youLine(all("welcome"))).toBe("welcome");
    expect(youLine(all("returning"))).toBe("returning");
    expect(youLine(all("returning_vip"))).toBe("returning_vip");
    expect(youLine(all("welcome_vip"))).toBe("welcome_vip");
    expect(youLine(all(null))).toBeNull();
    expect(youLine({ ...all("returning_vip"), returning_vip_bps: 0 })).toBeNull();
  });
});
