// MESITA-4405: the Story transition line carries ids, never a handle or a URL.
import { assertEquals } from "jsr:@std/assert@1";
import { logCreditStory, storyLogLine } from "./story-log.ts";

Deno.test("storyLogLine: ids and the device hash only; empty fields left out", () => {
  assertEquals(
    JSON.parse(storyLogLine("approved", { story_id: "s", purchase_id: "p", place_id: "pl", livemode: false, device_hash: "d", reason: null })),
    { story_event: "approved", story_id: "s", purchase_id: "p", place_id: "pl", livemode: false, device_hash: "d" },
  );
  const keys = Object.keys(JSON.parse(storyLogLine("void", { story_id: "s", reason: "expired" })));
  assertEquals(keys, ["story_event", "story_id", "reason"]);
});

Deno.test("logCreditStory: a credited Story logs created (and found/approved for an old buy's story)", () => {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (l: string) => lines.push(l);
  try {
    logCreditStory("p", { outcome: "credited", story: "waiting_post", story_id: "s" }, "test");
    logCreditStory("p", { outcome: "credited", story: "approved", story_id: "s" }, "test");
    logCreditStory("p", { outcome: "already_paid" }, "test");
    logCreditStory("p", { outcome: "credited" }, "test");
  } finally {
    console.log = orig;
  }
  assertEquals(lines.map((l) => JSON.parse(l.replace("[story] ", "")).story_event), ["created", "created", "approved"]);
});
