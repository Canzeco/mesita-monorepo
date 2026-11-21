// Supabase Edge Function — admin-web-list-story-desk
//
// MESITA-4267. The Stories page lists recent mentions and the Stories an
// operator can settle. Nothing is written.
//
// MESITA-4549: each mention carries what the AI bot decided (outcome,
// reason, model, last error), a thumbnail of the private story copy (signed
// for 10 minutes; "purged" after retention), and, for one the bot could not
// decide, the places the guest holds an open Story voucher at, so the
// operator can attach or reject it. Unread and unclear stories list first.
// Day counters cover the last 24 hours; `held` counts real Stories waiting
// because the kill switch (story_recheck_meta) is off.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { STORY_MEDIA_BUCKET } from "../_shared/story-verify.ts";

type Mention = {
  id: string;
  mentioned_at: string | null;
  source: string | null;
  deleted_at: string | null;
  ig_handle: string | null;
  media_kind: string | null;
  tagged_place_id: string | null;
  ai_outcome: string | null;
  ai_reason: string | null;
  ai_model: string | null;
  ai_checked_at: string | null;
  ai_last_error: string | null;
  ai_tries: number | null;
  ai_media_path: string | null;
  media_purged_at: string | null;
  ai_reviewed_at: string | null;
  livemode: boolean | null;
};

const DESK_FIRST = new Set(["unreadable", "ambiguous"]);

serveJson("admin-web-list-story-desk", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [stories, mentions, day, held] = await Promise.all([
    admin.from("stories").select("id, purchase_id, state, recheck_at, decided_at, void_reason, created_at, mention_id")
      .order("created_at", { ascending: false }).limit(30),
    admin.from("story_mentions")
      .select("id, mentioned_at, source, deleted_at, ig_handle, media_kind, tagged_place_id, ai_outcome, ai_reason, ai_model, ai_checked_at, ai_last_error, ai_tries, ai_media_path, media_purged_at, ai_reviewed_at, livemode")
      .order("mentioned_at", { ascending: false }).limit(40),
    admin.from("story_mentions").select("ai_outcome").gte("ai_checked_at", since).not("ai_outcome", "is", null),
    admin.from("stories").select("id", { count: "exact", head: true }).eq("state", "approved").eq("livemode", true).lte("recheck_at", new Date().toISOString()),
  ]);
  const error = stories.error ?? mentions.error ?? day.error;
  if (error) {
    console.error("[admin-web-list-story-desk]", error.message);
    return json({ ok: false, error: "Could not read Stories" }, 500);
  }

  const rows = (mentions.data ?? []) as Mention[];
  rows.sort((a, b) => Number(DESK_FIRST.has(b.ai_outcome ?? "")) - Number(DESK_FIRST.has(a.ai_outcome ?? "")));
  const enriched = await Promise.all(rows.map(async (m) => {
    let thumb: string | null = null;
    if (m.ai_media_path && !m.media_purged_at && m.media_kind !== "video") {
      const { data } = await admin.storage.from(STORY_MEDIA_BUCKET).createSignedUrl(m.ai_media_path, 600);
      thumb = data?.signedUrl ?? null;
    }
    let candidates: Array<{ place_id: string; name: string | null; handle: string | null }> = [];
    if (DESK_FIRST.has(m.ai_outcome ?? "")) {
      const { data } = await admin.rpc("story_ai_candidates", { p_mention: m.id });
      candidates = ((data ?? []) as Array<{ place_id: string; name: string | null; handle: string | null }>)
        .map((c) => ({ place_id: c.place_id, name: c.name, handle: c.handle }));
    }
    return { ...m, thumb_url: thumb, media: m.media_purged_at ? "purged" : m.media_kind === "video" ? "video" : thumb ? "image" : "none", candidates };
  }));

  const counters = { verified: 0, rejected: 0, unreadable: 0, ambiguous: 0, held: held.count ?? 0 };
  for (const r of (day.data ?? []) as Array<{ ai_outcome: string }>) {
    if (r.ai_outcome === "matched") counters.verified++;
    else if (r.ai_outcome in counters) counters[r.ai_outcome as "rejected" | "unreadable" | "ambiguous"]++;
  }
  return json({ ok: true, stories: stories.data ?? [], mentions: enriched, counters });
});
