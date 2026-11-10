// Live config saves (MVP test rule): a switch flip writes its own columns only,
// and Profile's page-wide save never carries a switch's value.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AdminPlace } from "../actions";
import { reservationsPatch } from "./action-patches";

const place = (fields: Partial<AdminPlace>) => ({ id: "p1", ...fields }) as AdminPlace;

describe("Actions switches write only their own columns", () => {
  it.each([true, false])("flips reservations from %s and writes nothing else", (on) => {
    expect(reservationsPatch(place({ reservations_enabled: on, reservation_channel: "whatsapp" }))).toEqual({
      id: "p1",
      reservations_enabled: !on,
    });
  });
});

describe("Profile's save", () => {
  it("never names a switch's column", () => {
    const src = readFileSync(join(process.cwd(), "src/components/place-manage/sections/PlaceSection.tsx"), "utf8");
    for (const column of ["reservations_enabled", "reservation_channel", "prepay_enabled", "payments_enabled"]) {
      expect(src, column).not.toContain(column);
    }
  });
});
