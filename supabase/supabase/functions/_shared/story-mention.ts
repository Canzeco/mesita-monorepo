// The Story's @mesita mention (MESITA-4264; bound to a Story record after
// payment since MESITA-4405). The guest posts an Instagram story from a
// public account mentioning @mesita and the place's Instagram; Meta tells
// Mesita about the mention (meta-instagram-receive-message); story_bind ties
// it to the guest's Story (stories.mention_id); a waiter approves it; the
// bonus's wait after the approval supabase-cron-recheck-stories fetches the
// story again and releases the bonus if it still loads.
//
// Meta is not switched on yet (MESITA-2579), so in Stripe test mode the
// emulator (consumer-web-emulate-story) produces the same mention a real
// story would, through the same recorder below.
//
// Mentions belong to a handle, never to a guest: a story is matched to the
// guest whose verified instagram_handle it was posted from.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { META_GRAPH_VERSION, readDmProfile, readInstagramDmConfig } from "./instagram-dm.ts";
import { paymentsLivemode } from "./stripe.ts";
import { STORY_MIN_FOLLOWERS } from "./money-state.ts";

// ── The rule numbers, in one place ───────────────────────────────────────────
// The database functions take the 3 hours and the two margins from
// app_config.money_config (story_bonus_wait_sec, story_credit_margin_sec,
// story_check_margin_sec) with these same defaults (story_rules()).
export const STORY_RULES = {
  /** Payment → the bonus, if the story is still up. */
  bonusWaitSec: 3 * 60 * 60,
  /** A failed re-check tries again after this long… */
  retrySec: 10 * 60,
  /** …and voids the bonus at this many failures. */
  maxTries: 3,
  /** A story the credit claims must outlive the re-check by this much: the
   *  3 tries 10 minutes apart, each up to one 10-minute cron tick late. */
  creditMarginSec: 60 * 60,
  /** …and the check asks a little more, so a story found is still good when
   *  the payment lands. */
  checkMarginSec: 90 * 60,
  /** A story lives 24 hours; an unclaimed mention is deleted after it. */
  mentionLifeSec: 24 * 60 * 60,
  /** Rows one cron tick takes. */
  rowsPerTick: 50,
  /** Fetches running at once in a tick. */
  parallel: 10,
  /** A tick stops taking rows after this long (the EF wall clock is longer). */
  tickBudgetMs: 100_000,
  /** One re-check fetch waits this long. */
  fetchTimeoutMs: 10_000,
  /** The Story screen looks for the story this often… */
  pollEveryMs: 5_000,
  /** …for this long, then every slowPollEveryMs (MESITA-4405). */
  pollForMs: 2 * 60_000,
  slowPollEveryMs: 15_000,
  /** Payment → the Story's deadline to be approved (MESITA-4405):
   *  money_config.story_post_window_sec, clamped 2–24 hours. */
  postWindowSec: 12 * 60 * 60,
  postWindowMinSec: 2 * 60 * 60,
  postWindowMaxSec: 24 * 60 * 60,
  /** The cron fills a mention's missing handle this many times. */
  handleTries: 3,
  /** A decided Story stays on the Wallet row this long. */
  decidedListedSec: 24 * 60 * 60,
} as const;

// ── Where mentions come from ─────────────────────────────────────────────────

/** 'meta': the real webhook is configured. 'emulated': payments run in Stripe
 *  test mode and Meta is off, so the emulator is the mention source.
 *  'unavailable': live payments with Meta off; Story is not sold. */
export type StoryMode = "meta" | "emulated" | "unavailable";

export function storyModeOf(args: { livemode: boolean; metaOn: boolean }): StoryMode {
  if (args.metaOn) return "meta";
  return args.livemode ? "unavailable" : "emulated";
}

/** The sale gate with the kill switch (MESITA-4535): a real Meta source sells
 *  Story only while story_recheck_meta is on, because the bonus is paid only
 *  on a fetched "still up". Off, the live Story offer is unavailable. */
export function storySaleMode(mode: StoryMode, recheckMeta: boolean): StoryMode {
  return mode === "meta" && !recheckMeta ? "unavailable" : mode;
}

/** The sale gate read live: storyMode() and the kill switch together. */
export async function storySaleModeLive(admin: SupabaseClient): Promise<StoryMode> {
  const mode = storyMode();
  if (mode !== "meta") return mode;
  return storySaleMode(mode, (await readStoryRules(admin)).recheckMeta);
}

/** The one gate Offers, the buy door, the Wallet and the emulator read. */
export function storyMode(get: (k: string) => string | undefined = (k) => Deno.env.get(k)): StoryMode {
  return storyModeOf({ livemode: paymentsLivemode(get), metaOn: readInstagramDmConfig(get) !== null });
}

// ── Media hosts ──────────────────────────────────────────────────────────────

const META_HOSTS = ["lookaside.fbsbx.com"];
const META_HOST_SUFFIXES = [".cdninstagram.com", ".fbcdn.net"];

/** The URL when it is https on Meta's CDN or this project's storage host;
 *  null otherwise (the mention is still kept, its card cannot show it). */
export function allowedMediaUrl(raw: unknown, storageHost: string | null): string | null {
  if (typeof raw !== "string" || raw.length > 4096) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (META_HOSTS.includes(host)) return u.toString();
  if (META_HOST_SUFFIXES.some((s) => host.endsWith(s))) return u.toString();
  if (storageHost && host === storageHost.toLowerCase()) return u.toString();
  return null;
}

/** The host of SUPABASE_URL (the emulator's images live there). */
export function storageHostOf(supabaseUrl: string): string | null {
  try {
    return new URL(supabaseUrl).hostname;
  } catch {
    return null;
  }
}

export function mediaKindOf(contentType: string | null | undefined): "image" | "video" {
  return typeof contentType === "string" && contentType.toLowerCase().startsWith("video/") ? "video" : "image";
}

// ── Meta's webhook ───────────────────────────────────────────────────────────

/** One story_mention attachment from Meta's Instagram messaging webhook. */
export type ParsedMention = {
  senderId: string;
  /** The message's `mid`; a second attachment in the same message gets `#<i>`. */
  storyId: string;
  url: string | null;
  mentionedAt: string;
};

/** Every story_mention attachment in a webhook body: messaging[].message
 *  .attachments[] with type "story_mention" and payload.url. Echoes, text and
 *  other attachment types are dropped; a repeated mid (Meta redelivers) is
 *  kept once. */
export function parseStoryMentions(body: unknown): ParsedMention[] {
  const b = body as { object?: unknown; entry?: unknown };
  if (b?.object !== "instagram" || !Array.isArray(b.entry)) return [];
  const out: ParsedMention[] = [];
  const seen = new Set<string>();
  for (const entry of b.entry as { messaging?: unknown }[]) {
    if (!Array.isArray(entry?.messaging)) continue;
    for (const ev of entry.messaging as Record<string, unknown>[]) {
      const sender = (ev?.sender as { id?: unknown } | undefined)?.id;
      const message = ev?.message as { mid?: unknown; is_echo?: unknown; attachments?: unknown } | undefined;
      if (typeof sender !== "string" || !message || message.is_echo === true) continue;
      if (typeof message.mid !== "string" || !message.mid || !Array.isArray(message.attachments)) continue;
      const ts = typeof ev.timestamp === "number" && Number.isFinite(ev.timestamp) ? ev.timestamp : Date.now();
      const mentionedAt = new Date(ts).toISOString();
      let i = 0;
      for (const att of message.attachments as { type?: unknown; payload?: { url?: unknown } }[]) {
        if (att?.type !== "story_mention") continue;
        const storyId = i === 0 ? message.mid : `${message.mid}#${i}`;
        i++;
        if (seen.has(storyId)) continue;
        seen.add(storyId);
        const url = typeof att.payload?.url === "string" ? att.payload.url : null;
        out.push({ senderId: sender, storyId, url, mentionedAt });
      }
    }
  }
  return out;
}

// ── Recording ────────────────────────────────────────────────────────────────

export type MentionInput = {
  handle: string | null;
  source: "meta" | "emulator";
  storyId: string;
  mediaUrl: string | null;
  mediaKind: "image" | "video";
  mentionedAt: string;
  livemode: boolean;
  senderIgsid: string | null;
};

/** The one recorder the webhook and the emulator share. A URL off the
 *  allowlist is logged and stored as null; the mention itself is kept.
 *  Idempotent on (source, story id). Throws when the write fails, so the
 *  webhook answers 5xx and Meta retries. */
export async function recordStoryMention(
  admin: SupabaseClient,
  m: MentionInput,
  storageHost: string | null,
): Promise<{ id: string; duplicate: boolean }> {
  const media = allowedMediaUrl(m.mediaUrl, storageHost);
  if (m.mediaUrl && !media) {
    let host = "unparsable";
    try {
      host = new URL(m.mediaUrl).hostname;
    } catch { /* logged as unparsable */ }
    console.warn("[story-mention] media_host_refused", JSON.stringify({ source: m.source, story_id: m.storyId, host }));
  }
  const { data, error } = await admin.rpc("wallet_record_story_mention", {
    p_handle: m.handle,
    p_source: m.source,
    p_story_id: m.storyId,
    p_media_url: media,
    p_media_kind: m.mediaKind,
    p_mentioned_at: m.mentionedAt,
    p_livemode: m.livemode,
    p_sender_igsid: m.senderIgsid,
  });
  if (error) throw new Error(`wallet_record_story_mention: ${error.message}`);
  const res = data as { ok?: boolean; outcome?: string; id?: string; code?: string } | null;
  if (!res?.ok || !res.id) throw new Error(`wallet_record_story_mention: ${res?.code ?? "no answer"}`);
  return { id: res.id, duplicate: res.outcome === "duplicate" };
}

// ── The re-check ─────────────────────────────────────────────────────────────

export type StillUp = {
  reachable: boolean;
  status: number | "timeout" | "error" | "no_url" | "kept" | "deleted" | "held" | "stored";
};

/** Whether a story's media still loads: GET with Range bytes=0-0 (a video is
 *  never downloaded), the body discarded, a 10-second timeout. 2xx/206 is
 *  up; anything else is down. The one place a later Graph API check replaces
 *  the CDN fetch (MESITA-2579's spike). */
export async function storyStillUp(
  url: string | null,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = STORY_RULES.fetchTimeoutMs,
): Promise<StillUp> {
  if (!url) return { reachable: false, status: "no_url" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { method: "GET", headers: { Range: "bytes=0-0" }, signal: ctrl.signal, redirect: "follow" });
    try {
      await res.body?.cancel();
    } catch { /* discarded either way */ }
    return { reachable: res.status >= 200 && res.status < 300, status: res.status };
  } catch (e) {
    return { reachable: false, status: ctrl.signal.aborted ? "timeout" : (e instanceof Error && e.name === "AbortError" ? "timeout" : "error") };
  } finally {
    clearTimeout(timer);
  }
}

/** An approved Story due for its re-check, with the mention it holds. */
export type RecheckRow = {
  story_id: string;
  purchase_id: string;
  mention: {
    source: "meta" | "emulator";
    media_url: string | null;
    deleted_at?: string | null;
    mentioned_at?: string | null;
    /** MESITA-4535: the still-up probe taken at bonus time for a story attached late. */
    reachable_at_bonus?: boolean | null;
  } | null;
};

/** The expiry a signed Meta CDN link carries (`oe=`, hex seconds), or null. */
export function cdnLinkExpiresAt(url: string | null): number | null {
  if (!url) return null;
  try {
    const oe = new URL(url).searchParams.get("oe");
    if (!oe || !/^[0-9a-f]{6,10}$/i.test(oe)) return null;
    return parseInt(oe, 16) * 1000;
  } catch {
    return null;
  }
}

/** Whether this row's story is still up (MESITA-4535). A real Meta story is
 *  fetched; with money_config.story_recheck_meta off (the kill switch) it is
 *  HELD, never paid blind. A signed link past its own expiry is held too
 *  (unknown, not down). A story attached after Instagram dropped it (24 h)
 *  settles on the probe taken at its bonus time. */
export async function recheckReachable(
  row: RecheckRow,
  recheckMeta: boolean,
  still: (url: string | null) => Promise<StillUp>,
  nowMs: number = Date.now(),
): Promise<StillUp & { fetched: boolean }> {
  if (row.mention?.source === "meta") {
    if (!recheckMeta) return { reachable: false, status: "held", fetched: false };
    const posted = row.mention.mentioned_at ? Date.parse(row.mention.mentioned_at) : NaN;
    const stored = row.mention.reachable_at_bonus;
    if (typeof stored === "boolean" && Number.isFinite(posted) && nowMs - posted > 20 * 3600_000) {
      return { reachable: stored, status: "stored", fetched: false };
    }
    const exp = cdnLinkExpiresAt(row.mention.media_url);
    if (exp !== null && exp <= nowMs) return { reachable: false, status: "held", fetched: false };
  }
  // MESITA-4310: a test story has no image; its delete is a flag.
  if (row.mention?.source === "emulator" && !row.mention.media_url) {
    return row.mention.deleted_at
      ? { reachable: false, status: "deleted", fetched: false }
      : { reachable: true, status: "kept", fetched: false };
  }
  const r = await still(row.mention?.media_url ?? null);
  return { ...r, fetched: true };
}

export type SettleAnswer = { ok?: boolean; outcome?: string; code?: string };

export type TickReport = { processed: number; released: number; voided: number; failed: number; skipped: number };

/** One tick over due rows: `parallel` at a time, no new row after
 *  `budgetMs`. One bad row logs a JSON line and the batch goes on. */
export async function runRecheckTick(args: {
  rows: RecheckRow[];
  check: (row: RecheckRow) => Promise<StillUp & { fetched?: boolean }>;
  settle: (storyId: string, reachable: boolean, deleted: boolean) => Promise<SettleAnswer>;
  parallel?: number;
  budgetMs?: number;
  now?: () => number;
  log?: (line: string) => void;
}): Promise<TickReport> {
  const parallel = Math.max(1, args.parallel ?? STORY_RULES.parallel);
  const budget = args.budgetMs ?? STORY_RULES.tickBudgetMs;
  const now = args.now ?? Date.now;
  const log = args.log ?? ((l: string) => console.log(l));
  const started = now();
  const report: TickReport = { processed: 0, released: 0, voided: 0, failed: 0, skipped: 0 };
  let next = 0;
  let held = 0;

  const one = async (row: RecheckRow) => {
    let step = "check";
    try {
      const r = await args.check(row);
      // MESITA-4535: a held story is not settled and spends no try.
      if (r.status === "held") {
        held++;
        return;
      }
      if (!r.reachable) {
        log(JSON.stringify({ fn: "recheck-stories", story_id: row.story_id, purchase_id: row.purchase_id, step: "fetch", status: r.status }));
      }
      step = "settle";
      const s = await args.settle(row.story_id, r.reachable, r.status === "deleted");
      if (s.ok === false) throw new Error(s.code ?? "refused");
      report.processed++;
      if (s.outcome === "released") report.released++;
      if (s.outcome === "voided") report.voided++;
    } catch (e) {
      report.failed++;
      log(JSON.stringify({ fn: "recheck-stories", story_id: row.story_id, purchase_id: row.purchase_id, step, error: e instanceof Error ? e.message : String(e) }));
    }
  };

  const worker = async () => {
    while (next < args.rows.length) {
      if (now() - started >= budget) return;
      const row = args.rows[next++];
      await one(row);
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, args.rows.length) }, worker));
  report.skipped = args.rows.length - next + held;
  return report;
}

// ── Reads ────────────────────────────────────────────────────────────────────

export type MentionRow = {
  id: string;
  ig_handle: string | null;
  purchase_id: string | null;
  media_url: string | null;
  media_kind: "image" | "video";
  source: "meta" | "emulator";
  mentioned_at: string;
  livemode: boolean;
  /** The waiter's decision at review_place_id (MESITA-4304). */
  review?: "approved" | "rejected" | null;
  review_place_id?: string | null;
};

export const MENTION_COLUMNS = "id, ig_handle, purchase_id, media_url, media_kind, source, mentioned_at, livemode, review, review_place_id";

/** A mention as staff and the Wallet see it. */
export type MentionView = { id: string; media_url: string | null; media_kind: "image" | "video"; mentioned_at: string; source: "meta" | "emulator" };

export function mentionView(m: MentionRow): MentionView {
  return { id: m.id, media_url: m.media_url, media_kind: m.media_kind, mentioned_at: m.mentioned_at, source: m.source };
}

/** Whether a mention can back a purchase in this mode (MESITA-4296): the
 *  same livemode (an emulator story only a test purchase, a real one only a
 *  live one) and still up long enough to outlive the re-check:
 *  mentioned_at + 24 h >= now + bonus wait + margin. The SQL claim
 *  (story_claim) applies the same rule with the credit margin. */
export function mentionFits(
  m: Pick<MentionRow, "livemode" | "mentioned_at">,
  purchaseLivemode: boolean,
  nowMs: number,
  rules: Pick<StoryRulesLive, "bonusWaitSec"> = { bonusWaitSec: STORY_RULES.bonusWaitSec },
  marginSec: number = STORY_RULES.checkMarginSec,
): boolean {
  if (m.livemode !== purchaseLivemode) return false;
  return Date.parse(m.mentioned_at) + STORY_RULES.mentionLifeSec * 1000 >= nowMs + (rules.bonusWaitSec + marginSec) * 1000;
}

/** Whether a mention is still on Instagram at all (under 24 hours). */
export function mentionAlive(m: Pick<MentionRow, "mentioned_at">, nowMs: number): boolean {
  return nowMs - Date.parse(m.mentioned_at) < STORY_RULES.mentionLifeSec * 1000;
}

/** The emulator's story ids: `emu-<consumer id>-<n>` (MESITA-4296: a story
 *  is posted before any purchase, so it belongs to the guest). */
export function emulatorStoryId(consumerId: string, n: number): string {
  return `emu-${consumerId}-${n}`;
}

/** n of an emulator story id of this guest, or null. */
export function emulatorN(storyId: string, consumerId: string): number | null {
  const prefix = `emu-${consumerId}-`;
  if (!storyId.startsWith(prefix)) return null;
  const n = Number(storyId.slice(prefix.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** The emulator's object path in the story-emulator bucket. */
export function emulatorPath(consumerId: string, n: number): string {
  return `${consumerId}/${n}.jpg`;
}

/** The emulator's public URL, versioned so a re-post never reads a cache. */
export function emulatorUrl(supabaseUrl: string, consumerId: string, n: number): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/story-emulator/${emulatorPath(consumerId, n)}?v=${n}`;
}

// ── The live rules (app_config.money_config) ─────────────────────────────────

export type StoryRulesLive = {
  bonusWaitSec: number;
  creditMarginSec: number;
  checkMarginSec: number;
  /** Fetch real Meta mentions again 3 hours later (off until the P9 spike). */
  recheckMeta: boolean;
  /** Payment → the Story's deadline (MESITA-4405), clamped as story_rules(). */
  postWindowSec: number;
  /** The follower floor for buying a Story voucher (MESITA-4425):
   *  money_config.story_min_followers, set on Admin › Configurations ›
   *  Stories; STORY_MIN_FOLLOWERS when unset or not a whole number. */
  minFollowers: number;
  /** Emulator mode switched on (MESITA-4426): money_config.story_emulator.
   *  In effect only in test mode with Meta off (storyEligibilityContext). */
  emulator: boolean;
  /** A test Story's bonus wait from an emulator story, 10–600 s (30). */
  emulatorBonusWaitSec: number;
  /** A test Story's time to post while the switch is on, 60–3600 s (120). */
  emulatorPostWindowSec: number;
  /** MESITA-4535, the AI bot: on/off without a deploy, and its limits. */
  aiEnabled: boolean;
  aiBatch: number;
  aiMaxTries: number;
  deskHours: number;
  mediaRetentionHours: number;
  staleDays: number;
};

/** The emulator keys' bounds and defaults (MESITA-4426), as SQL clamps them. */
export const STORY_EMULATOR = {
  bonusWait: { min: 10, max: 600, default: 30 },
  postWindow: { min: 60, max: 3600, default: 120 },
} as const;

function clampedInt(v: unknown, b: { min: number; max: number; default: number }): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(Math.trunc(v), b.min), b.max) : b.default;
}

/** story_min_followers' bounds (MESITA-4425), as money_config_merge_story. */
export const STORY_MIN_FOLLOWERS_MAX = 1_000_000;

/** A whole number in 0..STORY_MIN_FOLLOWERS_MAX, else the default. */
export function minFollowersFrom(v: unknown): number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= STORY_MIN_FOLLOWERS_MAX ? v : STORY_MIN_FOLLOWERS;
}

export function storyRulesFrom(raw: unknown): StoryRulesLive {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : d);
  return {
    bonusWaitSec: num(o.story_bonus_wait_sec, STORY_RULES.bonusWaitSec),
    creditMarginSec: num(o.story_credit_margin_sec, STORY_RULES.creditMarginSec),
    checkMarginSec: num(o.story_check_margin_sec, STORY_RULES.checkMarginSec),
    recheckMeta: o.story_recheck_meta === true,
    postWindowSec: Math.min(
      Math.max(num(o.story_post_window_sec, STORY_RULES.postWindowSec), STORY_RULES.postWindowMinSec),
      STORY_RULES.postWindowMaxSec,
    ),
    minFollowers: minFollowersFrom(o.story_min_followers),
    emulator: o.story_emulator === true,
    emulatorBonusWaitSec: clampedInt(o.story_emulator_bonus_wait_sec, STORY_EMULATOR.bonusWait),
    emulatorPostWindowSec: clampedInt(o.story_emulator_post_window_sec, STORY_EMULATOR.postWindow),
    // MESITA-4535: a missing key reads its default; the bot is on unless set off.
    aiEnabled: o.story_ai_enabled !== false,
    aiBatch: clampedInt(o.story_ai_batch, { min: 1, max: 50, default: 20 }),
    aiMaxTries: clampedInt(o.story_ai_max_tries, { min: 1, max: 10, default: 3 }),
    deskHours: clampedInt(o.story_desk_hours, { min: 1, max: 168, default: 48 }),
    mediaRetentionHours: clampedInt(o.story_media_retention_hours, { min: 24, max: 720, default: 72 }),
    staleDays: clampedInt(o.story_stale_days, { min: 1, max: 90, default: 30 }),
  };
}

/** A failed read reads the defaults, recheckMeta off. */
export async function readStoryRules(admin: SupabaseClient): Promise<StoryRulesLive> {
  const { data, error } = await admin.from("app_config").select("money_config").eq("id", 1).maybeSingle();
  if (error) console.error("[story-mention] rules_read_failed", JSON.stringify({ error: error.message }));
  return storyRulesFrom((data as { money_config?: unknown } | null)?.money_config);
}

// ── The sender's username ────────────────────────────────────────────────────

/** Meta's User Profile API: the sender's lowercased username, or null. */
export async function igUsername(
  accessToken: string,
  igsid: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const url = `https://graph.instagram.com/${META_GRAPH_VERSION}/${encodeURIComponent(igsid)}?fields=username&access_token=${
    encodeURIComponent(accessToken)
  }`;
  const res = await fetchImpl(url);
  if (!res.ok) {
    console.error("[story-mention] ig_profile_failed", res.status, (await res.text()).slice(0, 300));
    return null;
  }
  return readDmProfile(await res.json())?.handle ?? null;
}

/** The media's kind from a HEAD request (image when unknown or failed). */
export async function headMediaKind(url: string | null, fetchImpl: typeof fetch = fetch): Promise<"image" | "video"> {
  if (!url) return "image";
  try {
    const res = await fetchImpl(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    await res.body?.cancel();
    return mediaKindOf(res.headers.get("content-type"));
  } catch {
    return "image";
  }
}

// ── The emulator's gate ──────────────────────────────────────────────────────

export type EmulatorRefusal = { status: number; code: "not_test_mode" | "meta_on" | "emulator_off"; error: string };

/** Why the emulator refuses, or null (MESITA-4296: before any purchase, so it
 *  asks only the mode): only in Stripe test mode, only while the real
 *  webhook is off, and only while Admin's emulator switch is on
 *  (money_config.story_emulator, MESITA-4527). */
export function emulatorRefusal(livemode: boolean, metaOn: boolean, switchOn: boolean): EmulatorRefusal | null {
  if (metaOn) return { status: 409, code: "meta_on", error: "Instagram is connected: post a real story" };
  if (livemode) return { status: 409, code: "not_test_mode", error: "The story simulator works only in test mode" };
  if (!switchOn) return { status: 409, code: "emulator_off", error: "Story emulator mode is off in Admin" };
  return null;
}
