// Supabase Edge Function — enricher-edgefunc-write-place
//
// The one writer Render calls. Render is the agent and does not hold a
// database key. This function writes the finished profile and
// content_state = ready through the profiles view. google_found,
// instagram_found, and facebook_found are not columns of that view, so
// they are written to place_profiles after it. A body that is not a
// finished enrichment is refused and no row changes. A stop is the other
// accepted body: the task sends it when the run fails, before it exits,
// and enriching turns off; a closed stop also records Google's
// CLOSED_PERMANENTLY (the liveness halt).
//
// Around the commit (MESITA-2420): a field a person pinned is withheld, so
// an Enrich writes around a correction instead of over it; the Mesita Name
// the synthesis inferred lands through _shared/place-name-door.ts; and each
// step the run bought is stamped from what landed (./steps.ts).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { validateProfilePatch, writePlace } from "../_shared/place-doc.ts";
import { mirrorPlacePhotos, saveGalleryAnalyses } from "../_shared/store-place-images.ts";
import { pairedAnalyses } from "../_shared/photo-analysis.ts";
import { timingSafeEqual } from "../_shared/timing-safe-equal.ts";
import { activeFieldPins, readFieldPins, stripPinnedColumns } from "../_shared/enrich-corrections.ts";
import { readOperatorFields, stripOperatorFields } from "../_shared/operator-fields.ts";
import { applyInferredPlaceName } from "../_shared/place-name-door.ts";
import { reportCrenupSteps, stepFailed } from "../_shared/crenup-report.ts";
import { enrichmentCommit, enrichmentConflicts } from "./commit.ts";
import { fillAtlasProfile } from "./synthesize-profile.ts";
import { withoutFoundFlags } from "../_shared/profile-patch-found.ts";
import { galleryFromPatch, patchWithoutGallery } from "./photos.ts";
import { closedListingPatch, contentStateAfterStop, enrichmentStop } from "./stop.ts";
import { enrichStepOutcomes } from "./steps.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const writeKey = Deno.env.get("ENRICH_WRITE_KEY")?.trim() ?? "";
  if (!writeKey) return json({ ok: false, error: "Server misconfigured" }, 500);
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token || !timingSafeEqual(token, writeKey)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const bodyRes = await readJson<unknown>(req);
  if (!bodyRes.ok) return bodyRes.response;

  const admin = adminClient(envRes.env);
  const stop = enrichmentStop(bodyRes.body);
  if (stop.kind === "invalid") return json({ ok: false, error: stop.error }, 400);
  if (stop.kind === "stop") {
    if (stop.closed) {
      // Recorded first, so the fact stays queryable whatever the clear does.
      const recorded = await writePlace(admin, {
        table: "place_profiles",
        mode: "update",
        id: stop.placeId,
        patch: closedListingPatch(new Date().toISOString()),
      });
      if (!recorded.ok) return json({ ok: false, error: recorded.error }, 500);
      await reportCrenupSteps(admin, stop.placeId, {
        details: stepFailed(
          "Google reports this place permanently closed; the run stopped before any paid step.",
          { via: "render" },
        ),
      });
    }
    const { data, error } = await admin
      .from("profiles")
      .select("content_state, enriched_at")
      .eq("id", stop.placeId)
      .maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    const next = contentStateAfterStop({
      content_state: (data?.content_state ?? null) as string | null,
      enriched_at: (data?.enriched_at ?? null) as string | null,
    });
    if (!next) {
      return json({ ok: true, placeId: stop.placeId, content_state: data?.content_state ?? null });
    }
    // The read above picks ready or failed. The write itself matches only a
    // row that is still generating, so a finish that landed in between is
    // not overwritten.
    const cleared = await writePlace(admin, {
      table: "places",
      mode: "update",
      id: stop.placeId,
      patch: { content_state: next },
      onlyWhile: "generating",
      select: "content_state",
      selectMode: "maybeSingle",
    });
    if (!cleared.ok) return json({ ok: false, error: cleared.error }, 500);
    if (!cleared.row) {
      return json({ ok: true, placeId: stop.placeId, content_state: null });
    }
    return json({ ok: true, placeId: stop.placeId, content_state: next });
  }

  const commit = enrichmentCommit(bodyRes.body);
  if (!commit.ok) return json({ ok: false, error: commit.error }, 400);
  const { data: versionRow, error: versionErr } = await admin
    .from("profiles")
    .select(
      "updated_at, content_state, enriched_at, enrichment_sources, google_source_types, google_types, google_tags, category",
    )
    .eq("id", commit.placeId)
    .maybeSingle();
  if (versionErr) return json({ ok: false, error: versionErr.message }, 500);
  if (commit.baseUpdatedAt) {
    const current = (versionRow?.updated_at ?? null) as string | null;
    if (enrichmentConflicts(current, commit.baseUpdatedAt)) {
      const next = contentStateAfterStop({
        content_state: (versionRow?.content_state ?? null) as string | null,
        enriched_at: (versionRow?.enriched_at ?? null) as string | null,
      });
      if (next) {
        await writePlace(admin, {
          table: "places",
          mode: "update",
          id: commit.placeId,
          patch: { content_state: next },
        });
      }
      return json({
        ok: false,
        error: "The profile changed during enrichment. The previous profile was kept.",
      }, 409);
    }
  }
  const validated = validateProfilePatch(commit.patch);
  if (!validated.ok) return json({ ok: false, error: validated.error }, 400);

  const filled = await fillAtlasProfile(admin, commit.placeId, validated.patch, {
    serpSummary: commit.serpSummary,
  }, {
    google_source_types: versionRow?.google_source_types,
    google_types: versionRow?.google_types,
    google_tags: versionRow?.google_tags,
    category: versionRow?.category,
  });
  // A pin is a person's correction (Docs › Create · Enrich · Edit §D): the
  // run writes around it, never over it.
  const pins = activeFieldPins(readFieldPins(versionRow?.enrichment_sources));
  const unpinned = stripPinnedColumns(filled.patch, pins);
  if (unpinned.skipped.length > 0) {
    console.log(`[enrich] ${commit.placeId}: kept pinned ${unpinned.skipped.join(", ")}`);
  }
  // An operator's name, Presentation or tags stick through every Enrich
  // (MESITA-2829): the run writes around them until the operator's Reset.
  const owned = readOperatorFields(versionRow?.enrichment_sources);
  const unowned = stripOperatorFields(unpinned.update, owned);
  if (unowned.skipped.length > 0) {
    console.log(`[enrich] ${commit.placeId}: kept operator ${unowned.skipped.join(", ")}`);
  }
  let patch = unowned.update;
  const gallery = galleryFromPatch(patch);
  let stored: { sourceUrl: string; publicUrl: string }[] = [];
  if (gallery.length === 0) {
    patch = patchWithoutGallery(patch);
  } else if (!commit.mirrorPhotos) {
    patch = { ...patchWithoutGallery(patch), photos: gallery };
    stored = gallery.map((url) => ({ sourceUrl: url, publicUrl: url }));
  } else {
    const durable = await mirrorPlacePhotos(admin, envRes.env.url, gallery);
    if (durable.length > 0) {
      patch = {
        ...patchWithoutGallery(patch),
        photos: durable.map((row) => row.publicUrl),
      };
      stored = durable;
    } else {
      patch = patchWithoutGallery(patch);
    }
  }
  const split = withoutFoundFlags(patch);
  const written = await writePlace(admin, {
    table: "profiles",
    mode: "update",
    id: commit.placeId,
    patch: split.profile,
  });
  if (!written.ok) return json({ ok: false, error: written.error }, 500);
  if (Object.keys(split.found).length > 0) {
    const flags = await writePlace(admin, {
      table: "place_profiles",
      mode: "update",
      id: commit.placeId,
      patch: split.found,
    });
    if (!flags.ok) return json({ ok: false, error: flags.error }, 500);
  }
  await saveGalleryAnalyses(
    admin,
    commit.placeId,
    pairedAnalyses(stored, commit.photoAnalyses),
  );
  // Mesita Families (MESITA-2891) live on place_profiles; the profiles view
  // derives its column, so a write through the view would drop them.
  if (filled.families !== undefined) {
    const fam = await writePlace(admin, {
      table: "place_profiles",
      mode: "update",
      id: commit.placeId,
      patch: { family_keys: filled.families },
    });
    if (!fam.ok) console.error(`[enrich] ${commit.placeId}: families not stored: ${fam.error}`);
  }
  // After the profile, so the door sees this run's google_name. It writes
  // only over a name the machine owns; an operator's name stays.
  if (filled.mesitaName && !owned.includes("name")) {
    await applyInferredPlaceName(admin, commit.placeId, filled.mesitaName);
  }
  await reportCrenupSteps(
    admin,
    commit.placeId,
    enrichStepOutcomes({
      written: patch,
      steps: commit.steps,
      gallery: { sent: gallery.length, stored: stored.length },
    }),
  );
  return json({ ok: true, placeId: commit.placeId, content_state: "ready" });
});
