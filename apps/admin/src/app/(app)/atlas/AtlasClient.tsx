"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Archive,
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  Instagram,
  Loader2,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  setAtlasPreRead,
  snapshotAllVenues,
  updateAtlasConfig,
} from "./actions";

export function AtlasClient({
  initialPreReadEnabled,
  initialSaveSnapshots,
  initialGoogleImages,
  initialInstagramPosts,
  initialUpdatedAt,
}: {
  initialPreReadEnabled: boolean;
  initialSaveSnapshots: boolean;
  initialGoogleImages: number;
  initialInstagramPosts: number;
  initialUpdatedAt: string | null;
}) {
  const [preReadEnabled, setPreReadEnabled] = useState(initialPreReadEnabled);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [togglePending, startToggle] = useTransition();

  const [saveSnapshots, setSaveSnapshots] = useState(initialSaveSnapshots);
  const [saveToggleError, setSaveToggleError] = useState<string | null>(null);
  const [saveTogglePending, startSaveToggle] = useTransition();

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

  const toggleSaveSnapshots = () => {
    if (saveTogglePending) return;
    setSaveToggleError(null);
    const next = !saveSnapshots;
    setSaveSnapshots(next);
    startSaveToggle(async () => {
      const r = await updateAtlasConfig({ saveSnapshots: next });
      if (!r.ok) {
        setSaveSnapshots(!next);
        setSaveToggleError(r.error);
        return;
      }
      setSaveSnapshots(r.data.atlasSaveSnapshots);
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
                Reuse past research before fetching
              </h2>
            </div>
            <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
              When <span className="text-foreground font-medium">ON</span>,
              Atlas reads the research it saved for this venue before calling
              any external API, and only fetches what&apos;s missing. When{" "}
              <span className="text-foreground font-medium">OFF</span>, every
              create / update fetches from scratch.
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

          <Switch
            on={preReadEnabled}
            pending={togglePending}
            onClick={togglePreRead}
            label="Toggle Atlas pre-read"
          />
        </div>

        {toggleError && <ErrorNote message={toggleError} />}
      </section>

      {/* ─── Save-snapshot toggle ────────────────────────────────── */}
      <section className="border-border bg-card rounded-2xl border p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Archive className="text-muted-foreground h-4 w-4" />
              <h2 className="font-display text-base font-semibold tracking-tight">
                Save research from every run
              </h2>
            </div>
            <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
              When <span className="text-foreground font-medium">ON</span>,
              each run&apos;s research — what the external sources returned —
              is saved to Storage as append-only history, so the toggle on the
              left can reuse it. When{" "}
              <span className="text-foreground font-medium">OFF</span>,
              research is used once and not persisted.
            </p>
            <p className="text-muted-foreground mt-2 max-w-xl text-xs leading-relaxed italic">
              &ldquo;Research&rdquo; = the raw inputs from sources. The profile
              backup below is a different thing.
            </p>
          </div>

          <Switch
            on={saveSnapshots}
            pending={saveTogglePending}
            onClick={toggleSaveSnapshots}
            label="Toggle save snapshots"
          />
        </div>

        {saveToggleError && <ErrorNote message={saveToggleError} />}
      </section>

      {/* ─── Research params ─────────────────────────────────────── */}
      <ResearchParams
        initialGoogleImages={initialGoogleImages}
        initialInstagramPosts={initialInstagramPosts}
        onSaved={setUpdatedAt}
      />

      {/* ─── Snapshot all venues ─────────────────────────────────── */}
      <section className="border-border bg-card rounded-2xl border p-6 md:col-span-2">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Camera className="text-muted-foreground h-4 w-4" />
              <h2 className="font-display text-base font-semibold tracking-tight">
                Back up venue profiles now
              </h2>
            </div>
            <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
              Writes a backup of every venue&apos;s{" "}
              <span className="text-foreground font-medium">
                finished profile
              </span>{" "}
              — the canonical state from{" "}
              <code className="text-foreground bg-muted rounded px-1 text-[11px]">
                public.venues
              </code>{" "}
              — into{" "}
              <code className="text-foreground bg-muted rounded px-1 text-[11px]">
                atlas/venues/&lt;id&gt;/snapshots/mesita/
              </code>
              . This is the output, not the research inputs above.
            </p>
            <p className="text-muted-foreground mt-2 max-w-xl text-xs leading-relaxed italic">
              Routine backups will run nightly via cron (future PR). This
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
                Backing up…
              </>
            ) : (
              <>
                <Camera className="h-3.5 w-3.5" />
                Back up all
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

        {snapshotError && <ErrorNote message={snapshotError} />}
      </section>
    </div>
  );
}

// ─── Research params editor ──────────────────────────────────────────────

function ResearchParams({
  initialGoogleImages,
  initialInstagramPosts,
  onSaved,
}: {
  initialGoogleImages: number;
  initialInstagramPosts: number;
  onSaved: (updatedAt: string | null) => void;
}) {
  const [googleImages, setGoogleImages] = useState(initialGoogleImages);
  const [instagramPosts, setInstagramPosts] = useState(initialInstagramPosts);
  const [savedGoogleImages, setSavedGoogleImages] = useState(
    initialGoogleImages,
  );
  const [savedInstagramPosts, setSavedInstagramPosts] = useState(
    initialInstagramPosts,
  );
  const [pending, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    googleImages !== savedGoogleImages ||
    instagramPosts !== savedInstagramPosts;

  const save = () => {
    if (pending || !dirty) return;
    setError(null);
    setSaved(false);
    startSave(async () => {
      const r = await updateAtlasConfig({ googleImages, instagramPosts });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSavedGoogleImages(r.data.atlasResearchGoogleImages);
      setSavedInstagramPosts(r.data.atlasResearchInstagramPosts);
      setGoogleImages(r.data.atlasResearchGoogleImages);
      setInstagramPosts(r.data.atlasResearchInstagramPosts);
      onSaved(r.data.updatedAt);
      setSaved(true);
    });
  };

  return (
    <section className="border-border bg-card rounded-2xl border p-6 md:col-span-2">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="text-muted-foreground h-4 w-4" />
        <h2 className="font-display text-base font-semibold tracking-tight">
          Research params
        </h2>
      </div>
      <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
        How much Atlas pulls from each source per venue research run.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <NumberField
          icon={<ImageIcon className="text-muted-foreground h-4 w-4" />}
          label="Number of Google images"
          value={googleImages}
          min={0}
          max={20}
          onChange={setGoogleImages}
          disabled={pending}
        />
        <NumberField
          icon={<Instagram className="text-muted-foreground h-4 w-4" />}
          label="Number of Instagram posts"
          value={instagramPosts}
          min={0}
          max={50}
          onChange={setInstagramPosts}
          disabled={pending}
        />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            "Save params"
          )}
        </button>
        {saved && !dirty && (
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Saved
          </span>
        )}
      </div>

      {error && <ErrorNote message={error} />}
    </section>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────────

function Switch({
  on,
  pending,
  onClick,
  label,
}: {
  on: boolean;
  pending: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={on}
      aria-label={label}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        on ? "bg-foreground" : "bg-muted"
      }`}
    >
      <span
        className={`bg-background inline-block h-5 w-5 rounded-full shadow transition-transform ${
          on ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function NumberField({
  icon,
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <label className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          if (Number.isNaN(n)) return;
          onChange(Math.max(min, Math.min(max, n)));
        }}
        className="border-border bg-card focus:border-foreground h-9 w-20 rounded-lg border px-3 text-right text-sm tabular-nums outline-none disabled:opacity-50"
      />
    </label>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="border-destructive/40 bg-destructive/5 text-destructive mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p className="font-medium">{message}</p>
    </div>
  );
}
