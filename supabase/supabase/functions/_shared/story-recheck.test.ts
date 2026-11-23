// MESITA-4717 (Post): the recheck 10 hours after the first check decides the
// guest's money with no person in the loop. Pin how a fetched answer maps to
// pay, remove or wait.
import { assertEquals } from "jsr:@std/assert@1";
import { cdnLinkExpiresAtMs, recheckDecision, type RecheckRow, storyStillUp } from "./story-verify.ts";

const NOW = Date.parse("2026-11-23T18:00:00Z");
const fresh = `https://scontent.cdninstagram.com/v/a.jpg?oe=${Math.floor((NOW + 3 * 86400_000) / 1000).toString(16)}`;
const stale = `https://scontent.cdninstagram.com/v/a.jpg?oe=${Math.floor((NOW - 1000) / 1000).toString(16)}`;
const answer = (status: number): typeof fetch => () => Promise.resolve(new Response(status === 200 ? "x" : null, { status }));
const row = (over: Partial<RecheckRow> = {}): RecheckRow => ({
  id: "m",
  source: "meta",
  media_url: fresh,
  mentioned_at: new Date(NOW - 10 * 3600_000).toISOString(),
  ...over,
});

Deno.test("recheck: the link's own expiry is read from oe (hex seconds)", () => {
  assertEquals(cdnLinkExpiresAtMs("https://x.fbcdn.net/a?oe=6A000000"), 0x6a000000 * 1000);
  assertEquals(cdnLinkExpiresAtMs("https://x.fbcdn.net/a"), null);
  assertEquals(cdnLinkExpiresAtMs(null), null);
});

Deno.test("recheck: 200 is up, 403/404/410 on a live link is removed, 5xx is unknown", async () => {
  assertEquals(await storyStillUp(fresh, NOW, answer(200)), "up");
  for (const s of [403, 404, 410]) assertEquals(await storyStillUp(fresh, NOW, answer(s)), "removed");
  assertEquals(await storyStillUp(fresh, NOW, answer(503)), "unknown");
  assertEquals(await storyStillUp(fresh, NOW, () => Promise.reject(new Error("net"))), "unknown");
});

Deno.test("recheck: a link past its own signature is unknown, never removed", async () => {
  assertEquals(await storyStillUp(stale, NOW, answer(404)), "unknown");
  assertEquals(await storyStillUp(null, NOW, answer(200)), "unknown");
});

Deno.test("recheck: up pays, removed rejects, unknown waits; outlived 24 h always pays", () => {
  assertEquals(recheckDecision(row(), "up", NOW), "pay");
  assertEquals(recheckDecision(row(), "removed", NOW), "remove");
  assertEquals(recheckDecision(row(), "unknown", NOW), "wait");
  const old = row({ mentioned_at: new Date(NOW - 24 * 3600_000).toISOString() });
  assertEquals(recheckDecision(old, "removed", NOW), "pay");
  assertEquals(recheckDecision(old, "unknown", NOW), "pay");
});

Deno.test("recheck: an emulator story is up", () => {
  assertEquals(recheckDecision(row({ source: "emulator", media_url: null }), "unknown", NOW), "pay");
});
