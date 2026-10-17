// The only enrichment write Render is allowed to ask for.
// A finished place carries content_state "ready". Anything else is refused
// before a row is touched, so a place is enriched or it is not.

import type { PhotoAnalysis } from "../_shared/photo-analysis.ts";
import { readPhotoAnalyses } from "../_shared/photo-analysis.ts";

export type EnrichmentCommit =
  | {
    ok: true;
    placeId: string;
    patch: Record<string, unknown>;
    mirrorPhotos: boolean;
    photoAnalyses: PhotoAnalysis[];
    baseUpdatedAt: string | null;
  }
  | { ok: false; error: string };

/** True when a person saved the profile after this run started. */
export function enrichmentConflicts(
  currentUpdatedAt: string | null,
  baseUpdatedAt: string | null,
): boolean {
  if (!baseUpdatedAt) return false;
  return currentUpdatedAt !== baseUpdatedAt;
}

export function enrichmentCommit(body: unknown): EnrichmentCommit {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "body must be an object" };
  }
  const raw = body as {
    placeId?: unknown;
    patch?: unknown;
    mirrorPhotos?: unknown;
    photoAnalyses?: unknown;
    baseUpdatedAt?: unknown;
  };
  const placeId = typeof raw.placeId === "string" ? raw.placeId.trim() : "";
  if (!placeId) return { ok: false, error: "placeId is required" };
  if (typeof raw.patch !== "object" || raw.patch === null || Array.isArray(raw.patch)) {
    return { ok: false, error: "patch must be an object" };
  }
  const patch = raw.patch as Record<string, unknown>;
  if (patch.content_state !== "ready") {
    return { ok: false, error: "patch.content_state must be ready" };
  }
  const profileFields = Object.keys(patch).filter((key) => key !== "content_state");
  if (profileFields.length === 0) {
    return { ok: false, error: "a finished place needs its profile" };
  }
  // Absent means mirror, which is the Enrichment page default. An explicit
  // false is the Mirror switch turned off: keep the source URLs.
  const mirrorPhotos = raw.mirrorPhotos !== false;
  const photoAnalyses = readPhotoAnalyses(raw.photoAnalyses);
  const baseUpdatedAt = typeof raw.baseUpdatedAt === "string" && raw.baseUpdatedAt.trim()
    ? raw.baseUpdatedAt.trim()
    : null;
  return { ok: true, placeId, patch, mirrorPhotos, photoAnalyses, baseUpdatedAt };
}
