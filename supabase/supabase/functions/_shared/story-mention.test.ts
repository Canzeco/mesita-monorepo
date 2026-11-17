// MESITA-4264: the Story mention's money rules, without a database.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  allowedMediaUrl,
  emulatorN,
  emulatorRefusal,
  emulatorStoryId,
  emulatorUrl,
  mediaKindOf,
  mentionFits,
  parseStoryMentions,
  recheckReachable,
  type RecheckRow,
  runRecheckTick,
  STORY_RULES,
  storyExpiresAt,
  storyMode,
  storyModeOf,
  storyRulesFrom,
  storyStillUp,
} from "./story-mention.ts";

const STORAGE = "yjalywfzdelacdzccpgb.supabase.co";

Deno.test("media hosts: https on Meta's CDN or this project's storage only", () => {
  assert(allowedMediaUrl("https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1", STORAGE));
  assert(allowedMediaUrl("https://scontent-lax3-1.cdninstagram.com/v/t51/x.jpg", STORAGE));
  assert(allowedMediaUrl("https://video.xx.fbcdn.net/v/x.mp4", STORAGE));
  assert(allowedMediaUrl(`https://${STORAGE}/storage/v1/object/public/story-emulator/p/1.jpg?v=1`, STORAGE));
  assertEquals(allowedMediaUrl("http://lookaside.fbsbx.com/x", STORAGE), null, "http is refused");
  assertEquals(allowedMediaUrl("https://evil.example.com/x.jpg", STORAGE), null, "a foreign host is refused");
  assertEquals(allowedMediaUrl("https://cdninstagram.com.evil.com/x.jpg", STORAGE), null, "a lookalike suffix is refused");
  assertEquals(allowedMediaUrl("not a url", STORAGE), null);
  assertEquals(allowedMediaUrl(42, STORAGE), null);
});

Deno.test("mediaKindOf: video/* is video, anything else image", () => {
  assertEquals(mediaKindOf("video/mp4"), "video");
  assertEquals(mediaKindOf("image/jpeg"), "image");
  assertEquals(mediaKindOf(null), "image");
});

const fixture = (messaging: unknown[]) => ({ object: "instagram", entry: [{ id: "17841", time: 1, messaging }] });
const storyEvent = (mid: string, urls: string[], extra: Record<string, unknown> = {}) => ({
  sender: { id: "igsid-1" },
  recipient: { id: "17841" },
  timestamp: 1763380800000,
  message: { mid, attachments: urls.map((url) => ({ type: "story_mention", payload: { url } })), ...extra },
});

Deno.test("parseStoryMentions: story_mention attachments only (echo, text, other types dropped)", () => {
  const body = fixture([
    storyEvent("mid.1", ["https://lookaside.fbsbx.com/a"]),
    storyEvent("mid.echo", ["https://lookaside.fbsbx.com/b"], { is_echo: true }),
    { sender: { id: "igsid-2" }, timestamp: 1, message: { mid: "mid.text", text: "MESITA-ABC123" } },
    {
      sender: { id: "igsid-3" },
      timestamp: 1,
      message: { mid: "mid.img", attachments: [{ type: "image", payload: { url: "https://lookaside.fbsbx.com/c" } }] },
    },
  ]);
  const out = parseStoryMentions(body);
  assertEquals(out.length, 1);
  assertEquals(out[0], {
    senderId: "igsid-1",
    storyId: "mid.1",
    url: "https://lookaside.fbsbx.com/a",
    mentionedAt: new Date(1763380800000).toISOString(),
  });
  assertEquals(parseStoryMentions({ object: "page", entry: [] }), []);
  assertEquals(parseStoryMentions(null), []);
});

Deno.test("parseStoryMentions: two attachments in one message are two stories; a redelivered mid is one", () => {
  const out = parseStoryMentions(fixture([
    storyEvent("mid.2", ["https://lookaside.fbsbx.com/x", "https://lookaside.fbsbx.com/y"]),
    storyEvent("mid.2", ["https://lookaside.fbsbx.com/x", "https://lookaside.fbsbx.com/y"]),
  ]));
  assertEquals(out.map((m) => m.storyId), ["mid.2", "mid.2#1"]);
});

Deno.test("storyMode: meta when the webhook is configured, emulated in test mode, else unavailable", () => {
  assertEquals(storyModeOf({ livemode: false, metaOn: false }), "emulated");
  assertEquals(storyModeOf({ livemode: true, metaOn: false }), "unavailable");
  assertEquals(storyModeOf({ livemode: true, metaOn: true }), "meta");
  assertEquals(storyModeOf({ livemode: false, metaOn: true }), "meta");
  const env = (vars: Record<string, string>) => (k: string) => vars[k];
  assertEquals(storyMode(env({})), "emulated");
  assertEquals(
    storyMode(env({
      META_IG_APP_SECRET: "s",
      META_IG_VERIFY_TOKEN: "v",
      META_IG_ACCESS_TOKEN: "a",
      META_IG_USERNAME: "mesita",
    })),
    "meta",
  );
});

Deno.test("emulator: the caller's own test-mode Story only, and never with Meta on", () => {
  const mine = { consumer_id: "u", voucher: "voucher_story", livemode: false };
  assertEquals(emulatorRefusal(mine, "u", false), null);
  assertEquals(emulatorRefusal({ ...mine, livemode: true }, "u", false)?.code, "live_purchase");
  assertEquals(emulatorRefusal(mine, "someone-else", false)?.code, "not_your_purchase");
  assertEquals(emulatorRefusal({ ...mine, voucher: "voucher_200" }, "u", false)?.code, "not_your_purchase");
  assertEquals(emulatorRefusal(null, "u", false)?.code, "not_your_purchase");
  assertEquals(emulatorRefusal(mine, "u", true)?.code, "meta_on");
});

Deno.test("emulator ids and URLs: emu-<purchase>-<n>, versioned", () => {
  const p = "00000000-0000-4000-8000-000000004264";
  assertEquals(emulatorStoryId(p, 3), `emu-${p}-3`);
  assertEquals(emulatorN(`emu-${p}-3`, p), 3);
  assertEquals(emulatorN(`emu-${p}-x`, p), null);
  assertEquals(emulatorN("mid.1", p), null);
  assertEquals(
    emulatorUrl("https://x.supabase.co/", p, 2),
    `https://x.supabase.co/storage/v1/object/public/story-emulator/${p}/2.jpg?v=2`,
  );
});

Deno.test("mentionFits: a test story completes only a test purchase; 24 hours", () => {
  const now = Date.parse("2026-11-17T12:00:00Z");
  const fresh = "2026-11-17T11:00:00Z";
  assertEquals(mentionFits({ livemode: false, mentioned_at: fresh }, false, now), true);
  assertEquals(mentionFits({ livemode: false, mentioned_at: fresh }, true, now), false);
  assertEquals(mentionFits({ livemode: true, mentioned_at: fresh }, false, now), true);
  assertEquals(mentionFits({ livemode: true, mentioned_at: "2026-11-16T11:59:00Z" }, true, now), false);
});

Deno.test("rules: 3 h, 10 min, 3 tries, 7 days, 50 rows a tick, 10 at a time, 100 s, 10 s fetch", () => {
  assertEquals(STORY_RULES.bonusWaitSec, 10800);
  assertEquals(STORY_RULES.retrySec, 600);
  assertEquals(STORY_RULES.maxTries, 3);
  assertEquals(STORY_RULES.approveWindowDays, 7);
  assertEquals(STORY_RULES.rowsPerTick, 50);
  assertEquals(STORY_RULES.parallel, 10);
  assertEquals(STORY_RULES.tickBudgetMs, 100_000);
  assertEquals(STORY_RULES.fetchTimeoutMs, 10_000);
});

Deno.test("storyRulesFrom + storyExpiresAt: 7 days after max(paid_at, anchor)", () => {
  const rules = storyRulesFrom({ story_expiry_anchor: "2026-11-17T00:00:00Z", story_recheck_meta: false });
  assertEquals(rules.bonusWaitSec, 10800);
  assertEquals(rules.recheckMeta, false);
  assertEquals(storyExpiresAt("2026-11-10T00:00:00Z", rules), "2026-11-24T00:00:00.000Z", "an old purchase starts at the anchor");
  assertEquals(storyExpiresAt("2026-11-20T00:00:00Z", rules), "2026-11-27T00:00:00.000Z");
  assertEquals(storyRulesFrom(null).approveDays, 7);
  assertEquals(storyExpiresAt(null, rules), null);
});

Deno.test("storyStillUp: a Range GET; 2xx/206 up, anything else down, timeout down", async () => {
  let sent: RequestInit | undefined;
  const ok206: typeof fetch = (_u, init) => {
    sent = init;
    return Promise.resolve(new Response("x", { status: 206 }));
  };
  assertEquals((await storyStillUp("https://a/x.jpg", ok206)).reachable, true);
  assertEquals((sent?.headers as Record<string, string>).Range, "bytes=0-0");
  const gone: typeof fetch = () => Promise.resolve(new Response("no", { status: 404 }));
  assertEquals(await storyStillUp("https://a/x.jpg", gone), { reachable: false, status: 404 });
  const hang: typeof fetch = (_u, init) =>
    new Promise((_r, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  assertEquals(await storyStillUp("https://a/x.jpg", hang, 20), { reachable: false, status: "timeout" });
  assertEquals(await storyStillUp(null, ok206), { reachable: false, status: "no_url" });
});

Deno.test("recheckReachable: a real Meta mention is not fetched while story_recheck_meta is off", async () => {
  let fetched = 0;
  const still = () => {
    fetched++;
    return Promise.resolve({ reachable: false, status: 404 as const });
  };
  const meta: RecheckRow = { purchase_id: "p", mention: { source: "meta", media_url: "https://lookaside.fbsbx.com/a" } };
  assertEquals((await recheckReachable(meta, false, still)).reachable, true);
  assertEquals(fetched, 0);
  assertEquals((await recheckReachable(meta, true, still)).reachable, false);
  const emu: RecheckRow = { purchase_id: "p", mention: { source: "emulator", media_url: "https://x/1.jpg" } };
  assertEquals((await recheckReachable(emu, false, still)).reachable, false, "an emulator story is always fetched");
  assertEquals(fetched, 2);
});

Deno.test("runRecheckTick: one failing row is logged and the batch goes on", async () => {
  const rows: RecheckRow[] = ["a", "b", "c"].map((id) => ({ purchase_id: id, mention: null }));
  const logs: string[] = [];
  const report = await runRecheckTick({
    rows,
    check: (r) => r.purchase_id === "b" ? Promise.reject(new Error("boom")) : Promise.resolve({ reachable: true, status: 200 }),
    settle: () => Promise.resolve({ ok: true, outcome: "released" }),
    log: (l) => logs.push(l),
  });
  assertEquals(report, { processed: 2, released: 2, voided: 0, failed: 1, skipped: 0 });
  assert(logs.some((l) => l.includes('"purchase_id":"b"') && l.includes('"step":"check"')));
});

Deno.test("runRecheckTick: 50 hanging hosts finish inside the budget, 10 at a time", async () => {
  const rows: RecheckRow[] = Array.from({ length: 50 }, (_, i) => ({
    purchase_id: `p${i}`,
    mention: { source: "emulator" as const, media_url: "https://hang/x.jpg" },
  }));
  const hang: typeof fetch = (_u, init) =>
    new Promise((_r, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  let inFlight = 0;
  let peak = 0;
  const started = Date.now();
  // Scaled down: a 20 ms fetch timeout and a 100 ms budget stand for 10 s and 100 s.
  const report = await runRecheckTick({
    rows,
    check: async (row) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      try {
        return await storyStillUp(row.mention!.media_url, hang, 20);
      } finally {
        inFlight--;
      }
    },
    settle: (_id, reachable) => Promise.resolve({ ok: true, outcome: reachable ? "released" : "retry" }),
    parallel: 10,
    budgetMs: 100,
    log: () => {},
  });
  assert(Date.now() - started < 100 + 20 * 2 + 200, "the tick ends near its budget");
  assert(peak <= 10, `at most 10 fetches at once (saw ${peak})`);
  assertEquals(report.released, 0);
  assertEquals(report.processed + report.skipped + report.failed, 50);
});

Deno.test("runRecheckTick: an RPC refusal counts as failed, voided counts", async () => {
  const report = await runRecheckTick({
    rows: [{ purchase_id: "a", mention: null }, { purchase_id: "b", mention: null }],
    check: () => Promise.resolve({ reachable: false, status: 404 }),
    settle: (id) => Promise.resolve(id === "a" ? { ok: false, code: "not_approved" } : { ok: true, outcome: "voided" }),
    log: () => {},
  });
  assertEquals(report, { processed: 1, released: 0, voided: 1, failed: 1, skipped: 0 });
});
