"use server";

import { efInvoke } from "@/lib/supabase-ef";

// ─── Settings read ─────────────────────────────────────────────────────────

export type SynthesisQuality = "economy" | "standard" | "high";

type SettingsResponse = {
  autoVerifyAiCall: boolean;
  autoVerifyAiEmail: boolean;
  autoVerifyVideo: boolean;
  atlasPreReadSnapshots: boolean;
  atlasSaveSnapshots: boolean;
  atlasSnapshotOnBusinessEdit: boolean;
  atlasResearchGoogleImages: number;
  atlasResearchInstagramPosts: number;
  atlasResearchFacebookPosts: number;
  atlasSourceTierCeiling: number;
  atlasSourceOverrides: Record<string, boolean>;
  atlasSerpOnlyWhenThin: boolean;
  atlasGoogleReviews: number;
  atlasWebsiteCrawlMaxPages: number;
  atlasReviewsPerSite: number;
  atlasImageVisionEnabled: boolean;
  atlasMaxImagesAnalyzed: number;
  atlasPerSourceAiSummary: boolean;
  atlasSynthesisQuality: SynthesisQuality;
  atlasPerRunCostCapUsd: number;
  updatedAt: string | null;
};

type GetSettingsResult =
  | { ok: true; data: SettingsResponse }
  | { ok: false; error: string };

export async function getAtlasSettings(): Promise<GetSettingsResult> {
  const r = await efInvoke<SettingsResponse>("admin-get-settings", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

// ─── Atlas pre-read toggle ─────────────────────────────────────────────────

type SetPreReadResponse = {
  atlasPreReadSnapshots: boolean;
  updatedAt: string | null;
};

type SetPreReadResult =
  | { ok: true; data: SetPreReadResponse }
  | { ok: false; error: string };

export async function setAtlasPreRead(
  enabled: boolean,
): Promise<SetPreReadResult> {
  const r = await efInvoke<SetPreReadResponse>("admin-set-atlas-pre-read", {
    enabled,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

// ─── Atlas research config ─────────────────────────────────────────────────

type AtlasConfigResponse = {
  atlasSaveSnapshots: boolean;
  atlasSnapshotOnBusinessEdit: boolean;
  atlasResearchGoogleImages: number;
  atlasResearchInstagramPosts: number;
  atlasResearchFacebookPosts: number;
  atlasSourceTierCeiling: number;
  atlasSourceOverrides: Record<string, boolean>;
  atlasSerpOnlyWhenThin: boolean;
  atlasGoogleReviews: number;
  atlasWebsiteCrawlMaxPages: number;
  atlasReviewsPerSite: number;
  atlasImageVisionEnabled: boolean;
  atlasMaxImagesAnalyzed: number;
  atlasPerSourceAiSummary: boolean;
  atlasSynthesisQuality: SynthesisQuality;
  atlasPerRunCostCapUsd: number;
  updatedAt: string | null;
};

type UpdateAtlasConfigResult =
  | { ok: true; data: AtlasConfigResponse }
  | { ok: false; error: string };

// Partial update — pass only the fields you want to change.
export async function updateAtlasConfig(patch: {
  saveSnapshots?: boolean;
  snapshotOnBusinessEdit?: boolean;
  googleImages?: number;
  instagramPosts?: number;
  facebookPosts?: number;
  sourceTierCeiling?: number;
  sourceOverrides?: Record<string, boolean>;
  serpOnlyWhenThin?: boolean;
  googleReviews?: number;
  websiteCrawlMaxPages?: number;
  reviewsPerSite?: number;
  imageVisionEnabled?: boolean;
  maxImagesAnalyzed?: number;
  perSourceAiSummary?: boolean;
  synthesisQuality?: SynthesisQuality;
  perRunCostCapUsd?: number;
}): Promise<UpdateAtlasConfigResult> {
  const r = await efInvoke<AtlasConfigResponse>(
    "admin-update-atlas-config",
    patch,
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

// ─── Mesita snapshot trigger ───────────────────────────────────────────────

type SnapshotResult = {
  snapshotsWritten: number;
  snapshotsFailed: number;
  results: Array<{
    venueId: string;
    path: string;
    ok: boolean;
    error?: string;
  }>;
};

type TriggerSnapshotResult =
  | { ok: true; data: SnapshotResult }
  | { ok: false; error: string };

export async function snapshotAllVenues(): Promise<TriggerSnapshotResult> {
  const r = await efInvoke<SnapshotResult>("admin-snapshot-mesita", {
    all: true,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}
