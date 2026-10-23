import { assertEquals } from "jsr:@std/assert@1";
import { summarizeGuestSocial } from "./activity-summary.ts";

Deno.test("summarizeGuestSocial counts distinct members per kind", () => {
  const summary = summarizeGuestSocial([
    { consumer_id: "a", kind: "viewed" },
    { consumer_id: "a", kind: "saved" },
    { consumer_id: "b", kind: "viewed" },
  ]);
  assertEquals(summary.viewedMembers, 2);
  assertEquals(summary.savedMembers, 1);
  assertEquals(summary.viewedEvents, 2);
  assertEquals(summary.savedEvents, 1);
});
