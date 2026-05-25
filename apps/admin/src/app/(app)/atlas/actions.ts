"use server";

import { efInvoke } from "@/lib/supabase-ef";

// ─── Settings read ─────────────────────────────────────────────────────────

type SettingsResponse = {
  autoVerifyAiCall: boolean;
  autoVerifyAiEmail: boolean;
  autoVerifyVideo: boolean;
  atlasPreReadSnapshots: boolean;
  updatedAt: string | null;
};

export type GetSettingsResult =
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

export type SetPreReadResult =
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

export type TriggerSnapshotResult =
  | { ok: true; data: SnapshotResult }
  | { ok: false; error: string };

export async function snapshotAllVenues(): Promise<TriggerSnapshotResult> {
  const r = await efInvoke<SnapshotResult>("admin-snapshot-mesita", {
    all: true,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

export async function snapshotOneVenue(
  venueId: string,
): Promise<TriggerSnapshotResult> {
  const r = await efInvoke<SnapshotResult>("admin-snapshot-mesita", {
    venueId,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}
