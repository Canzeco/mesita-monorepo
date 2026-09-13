import { describe, expect, it } from "vitest";

import {
  REACH_ENTRY_CLASS,
  REACH_ENTRY_FOLLOWERS,
  passportDoorCaptions,
} from "@/lib/consumer-data";

// MESITA-1819: the four states Pato's screenshot made visible. Class is the
// perk. Climb doors only while the guest can still climb. Instagram is the
// next Instagram action. Origin unnamed.

const reach = {
  reachFollowers: REACH_ENTRY_FOLLOWERS,
  reachLabel: REACH_ENTRY_CLASS.label,
  followersLabel: "12.4k followers",
};

describe("passportDoorCaptions", () => {
  it("floor, Instagram off: starting perk + both climb doors; Instagram names the reach bar", () => {
    const { classNote, igNote } = passportDoorCaptions({
      unknown: false,
      onFloor: true,
      atCeiling: false,
      igConnected: false,
      ...reach,
    });
    expect(classNote).toBe(
      "Starting discount. Climb with Instagram or an invite.",
    );
    expect(igNote).toBe(
      `${REACH_ENTRY_FOLLOWERS.toLocaleString("en-US")}+ followers lifts you to ${REACH_ENTRY_CLASS.label}`,
    );
    expect(classNote).not.toMatch(/·/);
  });

  it("mid, Instagram off: higher perk + climb doors, still no middle-dot glue", () => {
    const { classNote, igNote } = passportDoorCaptions({
      unknown: false,
      onFloor: false,
      atCeiling: false,
      igConnected: false,
      ...reach,
    });
    expect(classNote).toBe(
      "Higher discount. Climb with Instagram or an invite.",
    );
    expect(igNote).toContain("followers lifts you to");
    expect(classNote).not.toMatch(/·/);
  });

  it("Diamond, Instagram off: perk only — not told how to get the class they hold", () => {
    const { classNote, igNote } = passportDoorCaptions({
      unknown: false,
      onFloor: false,
      atCeiling: true,
      igConnected: false,
      ...reach,
    });
    expect(classNote).toBe("Highest discount at every table.");
    expect(classNote).not.toMatch(/Instagram|invite/i);
    expect(igNote).toBe("Connect to share Stories and earn extra Rewards.");
    expect(igNote).not.toBe("Connect for Stories and Rewards");
  });

  it("connected: Class is the perk; Instagram is the follower count", () => {
    const ceiling = passportDoorCaptions({
      unknown: false,
      onFloor: false,
      atCeiling: true,
      igConnected: true,
      ...reach,
    });
    expect(ceiling.classNote).toBe("Highest discount at every table.");
    expect(ceiling.igNote).toBe("12.4k followers");

    const floor = passportDoorCaptions({
      unknown: false,
      onFloor: true,
      atCeiling: false,
      igConnected: true,
      ...reach,
    });
    expect(floor.classNote).toBe("Starting discount at every table.");
    expect(floor.classNote).not.toMatch(/Climb/);
  });

  it("unknown class is a retry, not a fake perk", () => {
    const { classNote } = passportDoorCaptions({
      unknown: true,
      onFloor: false,
      atCeiling: false,
      igConnected: false,
      ...reach,
    });
    expect(classNote).toBe("Come back to try");
  });
});
