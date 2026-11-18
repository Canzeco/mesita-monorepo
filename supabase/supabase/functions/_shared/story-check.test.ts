// MESITA-4296, MESITA-4405: the Story gate's fixed reason order, without a database.
import { assertEquals } from "jsr:@std/assert@1";
import { storyGate, type StoryGateInput } from "./story-check.ts";

const ok: StoryGateInput = { placeInstagram: true, guestRefusal: null, offerReason: null, mode: "emulated" };

Deno.test("storyGate: null when the guest may buy", () => {
  assertEquals(storyGate(ok), null);
  assertEquals(storyGate({ ...ok, mode: "meta" }), null);
});

Deno.test("storyGate: the reasons in their fixed order, each over the next", () => {
  const all: StoryGateInput = { placeInstagram: false, guestRefusal: "needs_instagram", offerReason: "needs_visit", mode: "unavailable" };
  assertEquals(storyGate(all), "place_no_instagram");
  assertEquals(storyGate({ ...all, placeInstagram: true }), "needs_instagram");
  assertEquals(storyGate({ ...all, placeInstagram: true, guestRefusal: "few_followers" }), "few_followers");
  assertEquals(storyGate({ ...all, placeInstagram: true, guestRefusal: "private_account" }), "private_account");
  assertEquals(storyGate({ ...all, placeInstagram: true, guestRefusal: null }), "already_bought");
  assertEquals(storyGate({ ...all, placeInstagram: true, guestRefusal: null, offerReason: null }), "story_unavailable");
  assertEquals(storyGate({ ...all, placeInstagram: true, guestRefusal: null, offerReason: "paused", mode: "emulated" }), "not_available");
});
