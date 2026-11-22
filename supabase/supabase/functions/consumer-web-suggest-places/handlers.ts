// consumer-web-suggest-places' two selection-time Google reads (MESITA-2987,
// moved out of _shared/name-pipeline.ts): the Location anchor and the
// Generate dialog's place preview. One Details call per pick, never per
// keystroke.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json } from "../_shared/http.ts";
import { loadEnrichmentConfig } from "../_shared/enrichment-config.ts";
import { previewAddVerdict } from "../_shared/consumer-create-verdict.ts";
import {
  fetchLocationAnchor,
  fetchPlacePreview,
  readGooglePlacesKey,
  stripPlacesPrefix,
} from "../_shared/google-places.ts";

/**
 * Selection-time anchor read for a picked Location (consumed by the map
 * anchor, MESITA-1405): ONE Location-shaped Details call per pick, never
 * per keystroke. Errors carry real statuses (MESITA-2855): the client's
 * invokeEF reads the body of a non-2xx reply, so nothing is swallowed.
 */
export async function runLocationAnchor(rawPlaceId: string): Promise<Response> {
  const keyRes = readGooglePlacesKey();
  if (!keyRes.ok) return keyRes.response;
  const placeId = stripPlacesPrefix(rawPlaceId.trim());
  if (!placeId) return json({ ok: false, error: "Missing anchorPlaceId" }, 400);
  const res = await fetchLocationAnchor(placeId, keyRes.key);
  if (!res.ok) {
    return res.reason === "not_found"
      ? json({ ok: false, code: "anchor_not_found", error: "Couldn't find that location." }, 404)
      : json({
        ok: false,
        code: "google_unreachable",
        error: "Couldn't resolve that location right now.",
      }, 502);
  }
  return json({ ok: true, anchor: res.anchor });
}

/**
 * The Generate dialog's Google preview (MESITA-2941): one Details call and
 * one photo per dialog open, so a guest sees the photo, category and stars
 * of the place before they create it, and `addable`: whether this guest may
 * add it (MESITA-4681). Errors carry real statuses like the anchor read; the
 * dialog turns Generate off only on a refusal; Create applies the same gates.
 */
export async function runPlacePreview(
  rawPlaceId: string,
  admin: SupabaseClient,
  consumerId: string | null,
): Promise<Response> {
  const keyRes = readGooglePlacesKey();
  if (!keyRes.ok) return keyRes.response;
  const placeId = stripPlacesPrefix(rawPlaceId.trim());
  if (!placeId) return json({ ok: false, error: "Missing previewPlaceId" }, 400);
  const res = await fetchPlacePreview(placeId, keyRes.key);
  if (!res.ok) {
    return res.reason === "not_found"
      ? json({ ok: false, code: "preview_not_found", error: "Couldn't find that place on Google." }, 404)
      : json({
        ok: false,
        code: "google_unreachable",
        error: "Couldn't load that place right now.",
      }, 502);
  }
  // May this guest add it? The same gates Create applies (MESITA-4681). The
  // preview shows the place either way; only Generate follows `addable`.
  const { primaryType: _p, types: _t, ...shown } = res.preview;
  const addable = await previewAddVerdict(
    admin,
    consumerId,
    res.preview,
    await loadEnrichmentConfig(admin),
  );
  return json({ ok: true, preview: shown, addable });
}
