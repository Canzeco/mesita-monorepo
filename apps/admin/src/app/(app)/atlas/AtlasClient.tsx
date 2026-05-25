"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  Search,
} from "lucide-react";
import {
  setAtlasPreRead,
  snapshotAllVenues,
} from "./actions";

export function AtlasClient({
  initialPreReadEnabled,
  initialUpdatedAt,
}: {
  initialPreReadEnabled: boolean;
  initialUpdatedAt: string | null;
}) {
  const [preReadEnabled, setPreReadEnabled] = useState(initialPreReadEnabled);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [togglePending, startToggle] = useTransition();

  const [snapshotPending, startSnapshot] = useTransition();
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotResult, setSnapshotResult] = useState<{
    written: number;
    failed: number;
  } | null>(null);

  const togglePreRead = () => {
    if (togglePending) return;
    setToggleError(null);
    const next = !preReadEnabled;
    // Optimistic update so the switch feels instant.
    setPreReadEnabled(next);
    startToggle(async () => {
      const r = await setAtlasPreRead(next);
      if (!r.ok) {
        // Roll back the optimistic update on failure.
        setPreReadEnabled(!next);
        setToggleError(r.error);
        return;
      }
      setPreReadEnabled(r.data.atlasPreReadSnapshots);
      setUpdatedAt(r.data.updatedAt);
    });
  };

  const triggerSnapshotAll = () => {
    if (snapshotPending) return;
    setSnapshotError(null);
    setSnapshotResult(null);
    startSnapshot(async () => {
      const r = await snapshotAllVenues();
      if (!r.ok) {
        setSnapshotError(r.error);
        return;
      }
      setSnapshotResult({
        written: r.data.snapshotsWritten,
        failed: r.data.snapshotsFailed,
      });
    });
  };

  return (
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      {/* ─── Pre-read toggle ─────────────────────────────────────── */}
      <section className="border-border bg-card rounded-2xl border p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Search className="text-muted-foreground h-4 w-4" />
              <h2 className="font-display text-base font-semibold tracking-tight">
                Pre-read snapshots before fetching
              </h2>
            </div>
            <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
              When <span className="text-foreground font-medium">ON</span>,
              Atlas reads past research snapshots with an LLM before any
              external API call and only fetches what&apos;s missing. When{" "}
              <span className="text-foreground font-medium">OFF</span>, every
              create / update fetches from scratch.
            </p>
            <p className="text-muted-foreground mt-2 max-w-xl text-xs leading-relaxed italic">
              Snapshots are saved either way — the toggle only gates the
              pre-read.
            </p>
            {updatedAt && (
              <p className="text-muted-foreground mt-3 text-[11px]">
                Last changed{" "}
                {new Date(updatedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={togglePreRead}
            disabled={togglePending}
            aria-pressed={preReadEnabled}
            aria-label="Toggle Atlas pre-read"
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
              preReadEnabled ? "bg-foreground" : "bg-muted"
            }`}
          >
            <span
              className={`bg-background inline-block h-5 w-5 rounded-full shadow transition-transform ${
                preReadEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {toggleError && (
          <div className="border-destructive/40 bg-destructive/5 text-destructive mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="font-medium">{toggleError}</p>
          </div>
        )}
      </section>

      {/* ─── Snapshot all venues ─────────────────────────────────── */}
      <section className="border-border bg-card rounded-2xl border p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Camera className="text-muted-foreground h-4 w-4" />
              <h2 className="font-display text-base font-semibold tracking-tight">
                Snapshot every venue now
              </h2>
            </div>
            <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
              Writes one Mesita snapshot per venue to Storage. Captures the
              current canonical profile state from{" "}
              <code className="text-foreground bg-muted rounded px-1 text-[11px]">
                public.venues
              </code>{" "}
              into{" "}
              <code className="text-foreground bg-muted rounded px-1 text-[11px]">
                atlas/venues/&lt;id&gt;/snapshots/mesita/
              </code>
              .
            </p>
            <p className="text-muted-foreground mt-2 max-w-xl text-xs leading-relaxed italic">
              Routine snapshots will run nightly via cron (future PR). This
              button is the manual trigger.
            </p>
          </div>

          <button
            type="button"
            onClick={triggerSnapshotAll}
            disabled={snapshotPending}
            className="bg-foreground text-background inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
          >
            {snapshotPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Snapshotting…
              </>
            ) : (
              <>
                <Camera className="h-3.5 w-3.5" />
                Snapshot all
              </>
            )}
          </button>
        </div>

        {snapshotResult && (
          <div className="border-foreground/20 bg-muted text-foreground mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="font-medium">
              {snapshotResult.written} snapshot
              {snapshotResult.written === 1 ? "" : "s"} written
              {snapshotResult.failed > 0
                ? `, ${snapshotResult.failed} failed`
                : ""}
              .
            </p>
          </div>
        )}

        {snapshotError && (
          <div className="border-destructive/40 bg-destructive/5 text-destructive mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="font-medium">{snapshotError}</p>
          </div>
        )}
      </section>
    </div>
  );
}
