// POST: a place pays a guest for an Instagram story (MESITA-4714, Pato,
// 2026-11-23: "20 OR 50, can setup in business console"). No purchase and no
// voucher: the guest posts a story tagging @mesita and the place; Meta's
// story_mention webhook (meta-instagram-receive-message) records it here;
// supabase-cron-verify-stories asks the model which place is tagged
// (_shared/story-verify.ts); story_reward_grant (SQL) marks it verified with
// no money; 10 hours later the same cron checks the story is still up
// (runStoryRecheck) and story_reward_pay (SQL, the one money writer) pays the
// place's story_reward_cents, available at once, one per guest per place per
// 7 days, only where Loyalty Cards is On (MESITA-4717, Pato: "Check Story,
// Wait 10 hours, Recheck Story, Receive credits. ALL AUTOMATIC"). In Stripe test mode a guest can
// simulate a story from the Post tab (consumer-web-simulate-story); live
// money never reads the emulator.
//
// Rebuilt from the Story voucher (git tag `stories-final`, _shared/story-
// mention.ts): the webhook parser, the username lookup and the media kind
// read are kept; the purchase binding, staff review and re-check are gone.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { META_GRAPH_VERSION, readDmProfile } from "./instagram-dm.ts";

// ── The rules (story_reward_grant mirrors them) ─────────────────────────────

/** First check → recheck (MESITA-4717). */
export const STORY_RECHECK_SEC = 10 * 60 * 60;
/** The recheck never runs later than this after posting, while an honest
 *  story is still up. */
export const STORY_RECHECK_LATEST_SEC = 23 * 60 * 60;
/** Test mode: an emulator story rechecks after 2 minutes. */
export const STORY_EMULATOR_RECHECK_SEC = 2 * 60;
/** At most one reward per guest per place in this window. */
export const STORY_REWARD_WINDOW_SEC = 7 * 24 * 60 * 60;
/** A story lives 24 hours; one still checking after that is closed. */
export const STORY_LIFE_SEC = 24 * 60 * 60;

export type StoryRejectReason =
  | "no_guest"
  | "no_tag"
  | "several_places"
  | "not_a_story"
  | "video"
  | "unreadable"
  | "off"
  | "repeat"
  | "expired"
  | "removed";

export type StoryRewardDecision =
  | { pay: true; cents: number; recheckAtMs: number }
  | { pay: false; reason: Extract<StoryRejectReason, "no_guest" | "off" | "repeat"> };

/** What one story that passed its first check at one place promises, pure
 *  (story_reward_grant's order): no verified guest → no_guest; Loyalty Cards
 *  Off or the reward Off → off; a story of this guest here paid or waiting in
 *  the last 7 days → repeat; else the place's reward now, paid at the recheck
 *  (10 hours later, never past the story's 23rd hour; emulator 2 minutes). */
export function storyRewardDecision(args: {
  guestMatched: boolean;
  loyaltyCards: boolean;
  rewardCents: number;
  /** The guest's latest story at this place paid or waiting (same mode), or null. */
  lastRewardAtMs: number | null;
  nowMs: number;
  /** When the story was posted (defaults to now). */
  postedAtMs?: number;
  emulator?: boolean;
}): StoryRewardDecision {
  if (!args.guestMatched) return { pay: false, reason: "no_guest" };
  if (!args.loyaltyCards || !(args.rewardCents > 0)) return { pay: false, reason: "off" };
  if (args.lastRewardAtMs != null && args.nowMs - args.lastRewardAtMs < STORY_REWARD_WINDOW_SEC * 1000) {
    return { pay: false, reason: "repeat" };
  }
  return { pay: true, cents: args.rewardCents, recheckAtMs: storyRecheckAtMs(args.nowMs, args.postedAtMs ?? args.nowMs, args.emulator === true) };
}

/** When the second check runs (story_reward_grant mirrors it). */
export function storyRecheckAtMs(checkedAtMs: number, postedAtMs: number, emulator: boolean): number {
  if (emulator) return checkedAtMs + STORY_EMULATOR_RECHECK_SEC * 1000;
  return Math.min(checkedAtMs + STORY_RECHECK_SEC * 1000, postedAtMs + STORY_RECHECK_LATEST_SEC * 1000);
}

/** When this guest can be paid for a story here again (null = now). */
export function nextStoryRewardAt(lastRewardAtMs: number | null, nowMs: number): string | null {
  if (lastRewardAtMs == null) return null;
  const at = lastRewardAtMs + STORY_REWARD_WINDOW_SEC * 1000;
  return at > nowMs ? new Date(at).toISOString() : null;
}

/** The guest's words for a rejection. */
export const STORY_REJECT_WORDS: Record<StoryRejectReason, string> = {
  no_guest: "Posted from an Instagram not linked to Mesita",
  no_tag: "The place wasn't tagged",
  several_places: "Several places were tagged",
  not_a_story: "It didn't look like a story",
  video: "Videos can't be checked yet; post a photo",
  unreadable: "We couldn't read it",
  off: "This place doesn't pay for stories",
  repeat: "One story reward per place every 7 days",
  expired: "It expired before we could check it",
  removed: "The story was gone when we checked again",
};

// ── Meta's webhook ──────────────────────────────────────────────────────────

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
 *  kept once. Kept from `stories-final`. */
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

const META_HOSTS = ["lookaside.fbsbx.com"];
const META_HOST_SUFFIXES = [".cdninstagram.com", ".fbcdn.net"];

/** The URL when it is https on Meta's CDN; null otherwise (the mention is
 *  still kept; the check cannot read it and closes it unreadable). */
export function allowedMediaUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 4096) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (META_HOSTS.includes(host) || META_HOST_SUFFIXES.some((s) => host.endsWith(s))) return u.toString();
  return null;
}

export function mediaKindOf(contentType: string | null | undefined): "image" | "video" {
  return typeof contentType === "string" && contentType.toLowerCase().startsWith("video/") ? "video" : "image";
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

/** Meta's User Profile API: the sender's lowercased username, or null. */
export async function igUsername(accessToken: string, igsid: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const url = `https://graph.instagram.com/${META_GRAPH_VERSION}/${encodeURIComponent(igsid)}?fields=username&access_token=${
    encodeURIComponent(accessToken)
  }`;
  const res = await fetchImpl(url);
  if (!res.ok) {
    console.error("[story-reward] ig_profile_failed", res.status, (await res.text()).slice(0, 300));
    return null;
  }
  return readDmProfile(await res.json())?.handle ?? null;
}

// ── Recording ───────────────────────────────────────────────────────────────

export type MentionInput = {
  handle: string | null;
  source: "meta" | "emulator";
  storyId: string;
  mediaUrl: string | null;
  mediaKind: "image" | "video";
  mentionedAt: string;
  livemode: boolean;
  senderIgsid: string | null;
  /** The emulator knows its guest and place; a real story is matched later. */
  consumerId?: string | null;
  placeId?: string | null;
};

/** The one recorder the webhook and the emulator share. Idempotent on
 *  (source, story id). Throws when the write fails, so the webhook answers
 *  5xx and Meta retries. */
export async function recordStoryMention(admin: SupabaseClient, m: MentionInput): Promise<{ id: string; duplicate: boolean }> {
  const handle = m.handle?.trim().replace(/^@/, "").toLowerCase() || null;
  const media = m.source === "meta" ? allowedMediaUrl(m.mediaUrl) : null;
  // A real story's guest is matched by its verified handle in SQL
  // (story_ai_claim, story_reward_grant); the emulator knows its guest.
  const consumerId = m.consumerId ?? null;
  const existing = await admin.from("story_mentions").select("id").eq("source", m.source).eq("ig_story_id", m.storyId).maybeSingle();
  if (existing.error) throw new Error(`story_mentions: ${existing.error.message}`);
  if (existing.data) return { id: existing.data.id as string, duplicate: true };
  const { data, error } = await admin
    .from("story_mentions")
    .insert({
      source: m.source,
      ig_story_id: m.storyId,
      sender_igsid: m.senderIgsid,
      ig_handle: handle,
      consumer_id: consumerId,
      place_id: m.placeId ?? null,
      media_url: media,
      media_kind: m.mediaKind,
      mentioned_at: m.mentionedAt,
      livemode: m.livemode,
    })
    .select("id")
    .single();
  if (error) {
    // A redelivery racing the first write.
    if (error.code === "23505") {
      const again = await admin.from("story_mentions").select("id").eq("source", m.source).eq("ig_story_id", m.storyId).single();
      if (again.data) return { id: again.data.id as string, duplicate: true };
    }
    throw new Error(`story_mentions: ${error.message}`);
  }
  return { id: data.id as string, duplicate: false };
}

// ── The emulator's gate ─────────────────────────────────────────────────────

/** Why the emulator refuses, or null: only while payments run in Stripe test
 *  mode, and only for a guest with a linked Instagram. */
export function emulatorRefusal(livemode: boolean, instagramLinked: boolean): { status: number; code: string; error: string } | null {
  if (livemode) return { status: 409, code: "not_test_mode", error: "The story simulator works only in test mode" };
  if (!instagramLinked) return { status: 409, code: "no_instagram", error: "Connect your Instagram first" };
  return null;
}

/** The emulator's story id: `emu-<consumer>-<ms>`. */
export function emulatorStoryId(consumerId: string, nowMs: number): string {
  return `emu-${consumerId}-${nowMs}`;
}

// ── What the guest sees ─────────────────────────────────────────────────────

export type StoryState = "checking" | "verified" | "rewarded" | "rejected";

export type StoryMentionRow = {
  id: string;
  state: StoryState;
  reject_reason: StoryRejectReason | null;
  reward_cents: number | null;
  decided_at: string | null;
  recheck_at: string | null;
  mentioned_at: string;
  source: "meta" | "emulator";
  media_url?: string | null;
  media_kind?: "image" | "video" | null;
};

export type StoryView = {
  id: string;
  state: StoryState;
  reward_cents: number | null;
  /** Verified: when the second check runs. */
  recheck_at: string | null;
  /** Rewarded: when the credit landed (the recheck, MESITA-4717). */
  available_at: string | null;
  /** The story the AI fetched (MESITA-4725): Meta's signed link for an
   *  image story; null for a video, a simulated story or no link. The guest
   *  only ever reads their own. The link expires; the page falls back. */
  image_url: string | null;
  reason: string | null;
  posted_at: string;
  simulated: boolean;
};

export function storyView(r: StoryMentionRow): StoryView {
  return {
    id: r.id,
    state: r.state,
    reward_cents: r.reward_cents,
    recheck_at: r.state === "verified" ? r.recheck_at : null,
    available_at: r.state === "rewarded" ? r.decided_at : null,
    image_url: r.source === "meta" && r.media_kind !== "video" ? r.media_url ?? null : null,
    reason: r.state === "rejected" && r.reject_reason ? STORY_REJECT_WORDS[r.reject_reason] ?? null : null,
    posted_at: r.mentioned_at,
    simulated: r.source === "emulator",
  };
}

// ── The Post tab's read ─────────────────────────────────────────────────────

/** A place's Instagram username from its profile URL, or null. */
export function instagramHandleOfUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.trim().match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i);
  return m ? m[1].toLowerCase() : null;
}

export const STORY_MENTION_COLUMNS = "id, state, reject_reason, reward_cents, decided_at, recheck_at, mentioned_at, source, media_url, media_kind";

export type PostRead = {
  /** What a story pays here now; 0 = Off (or Loyalty Cards Off). */
  reward_cents: number;
  currency: string;
  /** The place's Instagram username, when its profile names one. */
  place_handle: string | null;
  signed_in: boolean;
  instagram_linked: boolean;
  instagram_handle: string | null;
  /** Stripe test mode: the Post tab shows "Simulate a story". */
  simulate: boolean;
  /** When this guest can be paid here again (7-day window), or null. */
  next_at: string | null;
  latest: StoryView | null;
};

/** The Post tab's whole read for one place and (optionally) one guest. */
export async function readPost(
  admin: SupabaseClient,
  args: { placeId: string; consumerId: string | null; livemode: boolean; nowMs: number },
  readRates: (placeId: string) => Promise<{ story_reward_cents: number }>,
): Promise<{ ok: true; post: PostRead } | { ok: false; status: number; error: string }> {
  const [placeRes, settingsRes, guestRes] = await Promise.all([
    admin.from("profiles").select("id, currency, instagram_url").eq("id", args.placeId).maybeSingle(),
    admin.from("place_payment_settings").select("loyalty_cards").eq("place_id", args.placeId).maybeSingle(),
    args.consumerId
      ? admin.from("consumers").select("instagram_handle, instagram_verified_at").eq("id", args.consumerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (placeRes.error) return { ok: false, status: 500, error: `profiles: ${placeRes.error.message}` };
  if (!placeRes.data) return { ok: false, status: 404, error: "Place not found" };
  if (settingsRes.error) return { ok: false, status: 500, error: `place_payment_settings: ${settingsRes.error.message}` };
  if (guestRes.error) return { ok: false, status: 500, error: `consumers: ${guestRes.error.message}` };
  const loyalty = (settingsRes.data as { loyalty_cards?: boolean } | null)?.loyalty_cards === true;
  const rates = loyalty ? await readRates(args.placeId) : { story_reward_cents: 0 };
  const guest = guestRes.data as { instagram_handle: string | null; instagram_verified_at: string | null } | null;
  const linked = !!guest?.instagram_verified_at && !!guest.instagram_handle;

  let latest: StoryView | null = null;
  let nextAt: string | null = null;
  if (args.consumerId) {
    const handle = linked ? guest!.instagram_handle!.toLowerCase() : null;
    const [mentionRes, lastRes] = await Promise.all([
      admin
        .from("story_mentions")
        .select(`${STORY_MENTION_COLUMNS}, place_id`)
        .or(handle ? `consumer_id.eq.${args.consumerId},and(consumer_id.is.null,ig_handle.eq.${handle})` : `consumer_id.eq.${args.consumerId}`)
        .eq("livemode", args.livemode)
        .order("mentioned_at", { ascending: false })
        .limit(10),
      admin
        .from("wallet_entries")
        .select("created_at")
        .eq("consumer_id", args.consumerId)
        .eq("place_id", args.placeId)
        .eq("livemode", args.livemode)
        .eq("kind", "story")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    if (mentionRes.error) return { ok: false, status: 500, error: `story_mentions: ${mentionRes.error.message}` };
    if (lastRes.error) return { ok: false, status: 500, error: `wallet_entries: ${lastRes.error.message}` };
    // This place's latest, or one still checking whose place is not read yet.
    const row = ((mentionRes.data ?? []) as unknown as Array<StoryMentionRow & { place_id: string | null }>)
      .find((r) => r.place_id === args.placeId || (r.state === "checking" && r.place_id == null));
    latest = row ? storyView(row) : null;
    const last = (lastRes.data ?? [])[0] as { created_at: string } | undefined;
    // A story here still waiting for its recheck counts too (MESITA-4717).
    const waiting = ((mentionRes.data ?? []) as unknown as Array<StoryMentionRow & { place_id: string | null }>)
      .filter((r) => r.place_id === args.placeId && (r.state === "verified" || r.state === "rewarded"))
      .map((r) => Date.parse(r.mentioned_at));
    const times = [...waiting, ...(last ? [Date.parse(last.created_at)] : [])].filter(Number.isFinite);
    nextAt = nextStoryRewardAt(times.length ? Math.max(...times) : null, args.nowMs);
  }
  const place = placeRes.data as { currency: string | null; instagram_url: string | null };
  return {
    ok: true,
    post: {
      reward_cents: rates.story_reward_cents > 0 ? rates.story_reward_cents : 0,
      currency: (place.currency ?? "mxn").toLowerCase(),
      place_handle: instagramHandleOfUrl(place.instagram_url),
      signed_in: args.consumerId != null,
      instagram_linked: linked,
      instagram_handle: linked ? guest!.instagram_handle!.toLowerCase() : null,
      simulate: !args.livemode && linked,
      next_at: nextAt,
      latest,
    },
  };
}
