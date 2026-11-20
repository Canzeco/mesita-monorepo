// Supabase Edge Function — admin-web-list-story-desk
//
// MESITA-4267. The Stories page lists recent mentions and the Stories an
// operator can settle. Nothing is written.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";

serveJson("admin-web-list-story-desk", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;
  const [stories, mentions] = await Promise.all([
    admin.from("stories").select("id, purchase_id, state, recheck_at, decided_at, void_reason, created_at")
      .order("created_at", { ascending: false }).limit(30),
    admin.from("story_mentions").select("id, mentioned_at, source, deleted_at")
      .order("mentioned_at", { ascending: false }).limit(30),
  ]);
  const error = stories.error ?? mentions.error;
  if (error) {
    console.error("[admin-web-list-story-desk]", error.message);
    return json({ ok: false, error: "Could not read Stories" }, 500);
  }
  return json({ ok: true, stories: stories.data ?? [], mentions: mentions.data ?? [] });
});
