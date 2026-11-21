import { describe, expect, it } from "vitest";
import { DEFAULT_STORIES, emulatorPatch, floorPatch } from "./catalog";

const full = {
  ...DEFAULT_STORIES,
  story_min_followers: 50,
  story_emulator: true,
  story_emulator_bonus_wait_sec: 40,
  story_emulator_post_window_sec: 90,
};

describe("story config patches", () => {
  it("sends only the follower floor from Stories", () => {
    expect(floorPatch(full)).toEqual({ story_min_followers: 50 });
  });

  it("sends only the three emulator keys from Story", () => {
    expect(emulatorPatch(full)).toEqual({
      story_emulator: true,
      story_emulator_bonus_wait_sec: 40,
      story_emulator_post_window_sec: 90,
    });
  });

  it("keeps the two key sets disjoint and omits the read-only waits", () => {
    const floor = floorPatch(full);
    const emulator = emulatorPatch(full);
    for (const key of Object.keys(floor)) expect(emulator).not.toHaveProperty(key);
    expect(floor).not.toHaveProperty("story_bonus_wait_sec");
    expect(floor).not.toHaveProperty("story_post_window_sec");
    expect(emulator).not.toHaveProperty("story_bonus_wait_sec");
    expect(emulator).not.toHaveProperty("story_post_window_sec");
  });
});
