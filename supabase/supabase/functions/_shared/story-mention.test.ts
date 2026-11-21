// MESITA-4264, MESITA-4296: the Story mention's money rules, without a database.
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

Deno.test("emulator: test mode only, and never with Meta on (MESITA-4296: no purchase needed)", () => {
  assertEquals(emulatorRefusal(false, false, true), null);
  assertEquals(emulatorRefusal(true, false, true)?.code, "not_test_mode");
  assertEquals(emulatorRefusal(false, true, true)?.code, "meta_on");
  // MESITA-4527: Admin's switch off refuses even in test mode.
  assertEquals(emulatorRefusal(false, false, false)?.code, "emulator_off");
});

Deno.test("emulator ids and URLs: emu-<consumer>-<n>, versioned", () => {
  const c = "00000000-0000-4000-8000-000000004296";
  assertEquals(emulatorStoryId(c, 3), `emu-${c}-3`);
  assertEquals(emulatorN(`emu-${c}-3`, c), 3);
  assertEquals(emulatorN(`emu-${c}-x`, c), null);
  assertEquals(emulatorN("mid.1", c), null);
  assertEquals(
    emulatorUrl("https://x.supabase.co/", c, 2),
    `https://x.supabase.co/storage/v1/object/public/story-emulator/${c}/2.jpg?v=2`,
  );
});

Deno.test("mentionFits: same livemode only; must outlive the re-check by the margin (MESITA-4296)", () => {
  const now = Date.parse("2026-11-17T12:00:00Z");
  const fresh = "2026-11-17T11:00:00Z";
  assertEquals(mentionFits({ livemode: false, mentioned_at: fresh }, false, now), true);
  assertEquals(mentionFits({ livemode: false, mentioned_at: fresh }, true, now), false, "a test story never pays a live purchase");
  assertEquals(mentionFits({ livemode: true, mentioned_at: fresh }, false, now), false, "a live story never pays a test purchase");
  // 24 h − 3 h − 90 min = 19 h 30 min: the check's boundary.
  const edge = new Date(now - (19 * 3600 + 30 * 60) * 1000).toISOString();
  const past = new Date(now - (19 * 3600 + 30 * 60 + 1) * 1000).toISOString();
  assertEquals(mentionFits({ livemode: true, mentioned_at: edge }, true, now), true, "exactly at the check margin fits");
  assertEquals(mentionFits({ livemode: true, mentioned_at: past }, true, now), false, "one second past does not");
  // 24 h − 3 h − 60 min = 20 h: the credit's boundary.
  const credit = new Date(now - 20 * 3600 * 1000).toISOString();
  const rules = { bonusWaitSec: 10800 };
  assertEquals(mentionFits({ livemode: true, mentioned_at: credit }, true, now, rules, STORY_RULES.creditMarginSec), true);
  assertEquals(mentionFits({ livemode: true, mentioned_at: credit }, true, now + 1000, rules, STORY_RULES.creditMarginSec), false);
});

Deno.test("rules: 3 h, 10 min, 3 tries, margins 60/90 min, 50 rows a tick, 10 at a time, 100 s, 10 s fetch, 5 s poll for 2 min", () => {
  assertEquals(STORY_RULES.bonusWaitSec, 10800);
  assertEquals(STORY_RULES.retrySec, 600);
  assertEquals(STORY_RULES.maxTries, 3);
  assertEquals(STORY_RULES.creditMarginSec, 3600);
  assertEquals(STORY_RULES.checkMarginSec, 5400);
  assert(STORY_RULES.creditMarginSec >= STORY_RULES.retrySec * STORY_RULES.maxTries + STORY_RULES.retrySec, "the margin covers 3 tries plus one cron tick");
  assert(STORY_RULES.checkMarginSec > STORY_RULES.creditMarginSec, "the check asks more than the credit");
  assertEquals(STORY_RULES.rowsPerTick, 50);
  assertEquals(STORY_RULES.parallel, 10);
  assertEquals(STORY_RULES.tickBudgetMs, 100_000);
  assertEquals(STORY_RULES.fetchTimeoutMs, 10_000);
  assertEquals(STORY_RULES.pollEveryMs, 5_000);
  assertEquals(STORY_RULES.pollForMs, 120_000);
});

Deno.test("storyRulesFrom: the live config with the defaults", () => {
  const rules = storyRulesFrom({ story_credit_margin_sec: 1800, story_recheck_meta: true });
  assertEquals(rules.bonusWaitSec, 10800);
  assertEquals(rules.creditMarginSec, 1800);
  assertEquals(rules.checkMarginSec, 5400);
  assertEquals(rules.recheckMeta, true);
  assertEquals(storyRulesFrom(null).recheckMeta, false);
});

Deno.test("storyRulesFrom: the post window defaults to 12 h and is clamped 2–24 h, as story_rules()", () => {
  assertEquals(storyRulesFrom(null).postWindowSec, 43_200);
  assertEquals(storyRulesFrom({ story_post_window_sec: 21_600 }).postWindowSec, 21_600);
  assertEquals(storyRulesFrom({ story_post_window_sec: 60 }).postWindowSec, 7_200);
  assertEquals(storyRulesFrom({ story_post_window_sec: 999_999 }).postWindowSec, 86_400);
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

Deno.test("recheckReachable: with story_recheck_meta off a real Meta story is HELD, never paid blind (MESITA-4535)", async () => {
  let fetched = 0;
  const still = () => {
    fetched++;
    return Promise.resolve({ reachable: false, status: 404 as const });
  };
  const meta: RecheckRow = { story_id: "s", purchase_id: "p", mention: { source: "meta", media_url: "https://lookaside.fbsbx.com/a" } };
  assertEquals(await recheckReachable(meta, false, still), { reachable: false, status: "held", fetched: false });
  assertEquals(fetched, 0);
  assertEquals((await recheckReachable(meta, true, still)).reachable, false);
  const emu: RecheckRow = { story_id: "s", purchase_id: "p", mention: { source: "emulator", media_url: "https://x/1.jpg" } };
  assertEquals((await recheckReachable(emu, false, still)).reachable, false, "an emulator story is always fetched");
  assertEquals(fetched, 2);
  // MESITA-4310: a test story without media is decided by its delete flag, never fetched.
  const kept: RecheckRow = { story_id: "s", purchase_id: "p", mention: { source: "emulator", media_url: null, deleted_at: null } };
  assertEquals(await recheckReachable(kept, false, still), { reachable: true, status: "kept", fetched: false });
  const gone: RecheckRow = { story_id: "s", purchase_id: "p", mention: { source: "emulator", media_url: null, deleted_at: "2026-11-17T12:00:00Z" } };
  assertEquals(await recheckReachable(gone, false, still), { reachable: false, status: "deleted", fetched: false });
  assertEquals(fetched, 2);
});

Deno.test("runRecheckTick: one failing row is logged and the batch goes on", async () => {
  const rows: RecheckRow[] = ["a", "b", "c"].map((id) => ({ story_id: id, purchase_id: id, mention: null }));
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
    story_id: `s${i}`,
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
    rows: [{ story_id: "a", purchase_id: "a", mention: null }, { story_id: "b", purchase_id: "b", mention: null }],
    check: () => Promise.resolve({ reachable: false, status: 404 }),
    settle: (id) => Promise.resolve(id === "a" ? { ok: false, code: "not_approved" } : { ok: true, outcome: "voided" }),
    log: () => {},
  });
  assertEquals(report, { processed: 1, released: 0, voided: 1, failed: 1, skipped: 0 });
});

Deno.test("recheckReachable: an expired signed link is held; a late attach uses the stored probe (MESITA-4535)", async () => {
  let fetched = 0;
  const still = () => {
    fetched++;
    return Promise.resolve({ reachable: true, status: 200 as const });
  };
  const now = Date.parse("2026-11-21T12:00:00Z");
  const expiredOe = Math.floor((now - 60_000) / 1000).toString(16);
  const expired: RecheckRow = {
    story_id: "s", purchase_id: "p",
    mention: { source: "meta", media_url: `https://lookaside.fbsbx.com/a?oe=${expiredOe}`, mentioned_at: "2026-11-21T08:00:00Z" },
  };
  assertEquals(await recheckReachable(expired, true, still, now), { reachable: false, status: "held", fetched: false });
  const late: RecheckRow = {
    story_id: "s", purchase_id: "p",
    mention: { source: "meta", media_url: "https://lookaside.fbsbx.com/a", mentioned_at: "2026-11-20T08:00:00Z", reachable_at_bonus: true },
  };
  assertEquals(await recheckReachable(late, true, still, now), { reachable: true, status: "stored", fetched: false });
  assertEquals(fetched, 0);
});

Deno.test("runRecheckTick: a held story is not settled (MESITA-4535)", async () => {
  let settled = 0;
  const report = await runRecheckTick({
    rows: [{ story_id: "s", purchase_id: "p", mention: { source: "meta", media_url: "https://x" } }],
    check: () => Promise.resolve({ reachable: false, status: "held" as const }),
    settle: () => {
      settled++;
      return Promise.resolve({ ok: true, outcome: "retry" });
    },
    log: () => {},
  });
  assertEquals(settled, 0);
  assertEquals(report.skipped, 1);
});
