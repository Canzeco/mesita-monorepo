// Live config saves (MVP test rule): a switch flip writes its own columns only,
// and Profile's page-wide save never carries a switch's value.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AdminPlace } from "../actions";
import { prepayPatch, reservationsPatch } from "./action-patches";

const place = (fields: Partial<AdminPlace>) => ({ id: "p1", ...fields }) as AdminPlace;

describe("Actions switches write only their own columns", () => {
  it("turns reservations off with channel none", () => {
    expect(reservationsPatch(place({ reservations_enabled: true, reservation_channel: "whatsapp" }))).toEqual({
      id: "p1",
      reservations_enabled: false,
      reservation_channel: "none",
    });
  });

  it("turns reservations on keeping the place's channel", () => {
    expect(reservationsPatch(place({ reservations_enabled: false, reservation_channel: "web" }))).toEqual({
      id: "p1",
      reservations_enabled: true,
      reservation_channel: "web",
    });
  });

  it.each([null, undefined, "none"])("turns reservations on with phone when the channel is %s", (channel) => {
    expect(reservationsPatch(place({ reservations_enabled: false, reservation_channel: channel }))).toEqual({
      id: "p1",
      reservations_enabled: true,
      reservation_channel: "phone",
    });
  });

  it("flips prepay alone, reading a missing value as off", () => {
    expect(prepayPatch(place({ prepay_enabled: true }))).toEqual({ id: "p1", prepay_enabled: false });
    expect(prepayPatch(place({}))).toEqual({ id: "p1", prepay_enabled: true });
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
