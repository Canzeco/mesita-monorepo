"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import {
  enrichPlace,
  getPlaceEnrichment,
  setPlaceEnrichmentSchedule,
  type AdminPlace,
  type PlaceEnrichmentSchedule,
  type PlaceEnrichmentStatus,
  type ReenrichMode,
} from "../actions";
import { REENRICH_MODES } from "../reenrich-modes";
import { useSectionDirty } from "../useSectionDirty";
import { ReadField, SaveBar, SectionCard, Spinner } from "../ui";
import { usePlaceContext } from "../PlaceContext";
import { formatAbsoluteUtc } from "@/lib/format";

// Enrichment — WHEN this place re-enriches, and the button that runs it now
// (MESITA-1148 · MESITA-1155).
//
// The trigger used to be a dropdown in the place chrome, beside Switch place.
// Pato moved it here: "remove button to re enrich and put it in admin that
// button on the header." Scheduling a refresh and running one are the same
// decision about the same pipeline, so they share a box — and an expensive
// overwrite stops sitting one mis-tap away on every tab.
//
// The cadence writes places.enrich_every_days / enrich_mode / enrich_next_at
// through admin-web-set-place-enrichment; the pg_cron enqueuer
// (queue_due_place_enrichments, every 15 min) seeds place_research when a
// place comes due, and run_place_enrichment_stages stays the only dispatcher.
// Run now goes through admin-web-enrich-place, which seeds the same row.
//
// The live enriching STATUS stays in the chrome (MESITA-896) — it belongs on
// every tab; only the trigger moved.
//
// Admin tab, not Settings: the Enricher is Mesita's own pipeline burning
// Mesita's own API budget. A business never schedules it.
const CADENCES: { value: number | null; label: string; hint: string }[] = [
  { value: null, label: "Manual only", hint: "Nothing runs unless you press Run now." },
  { value: 7, label: "Weekly", hint: "For places whose hours and menu move constantly." },
  { value: 30, label: "Monthly", hint: "The sane default for a place that's live." },
  { value: 90, label: "Quarterly", hint: "Cheap upkeep for a stable listing." },
];

const MODES = REENRICH_MODES;

export function EnrichmentCard({ place }: { place: AdminPlace }) {
  const [loaded, setLoaded] = useState<PlaceEnrichmentSchedule | null>(null);
  const [status, setStatus] = useState<PlaceEnrichmentStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [everyDays, setEveryDays] = useState<number | null>(null);
  const [mode, setMode] = useState<ReenrichMode>("full");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let alive = true;
    getPlaceEnrichment(place.id).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setLoadError(r.error);
        return;
      }
      const s = r.data.schedule;
      setStatus(r.data.status);
      setLoaded(s);
      if (s) {
        setEveryDays(s.everyDays);
        setMode(s.mode);
      }
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  const dirty =
    loaded !== null &&
    (everyDays !== loaded.everyDays || mode !== loaded.mode);

  const resetDraft = useCallback(() => {
    if (loaded) {
      setEveryDays(loaded.everyDays);
      setMode(loaded.mode);
    }
    setError(null);
    setOk(false);
  }, [loaded]);
  useSectionDirty("enrichment", dirty, resetDraft);

  const save = () => {
    setError(null);
    setOk(false);
    start(async () => {
      const r = await setPlaceEnrichmentSchedule(place.id, { everyDays, mode });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setLoaded(r.data);
      setEveryDays(r.data.everyDays);
      setMode(r.data.mode);
      setOk(true);
      window.setTimeout(() => setOk(false), 2500);
    });
  };

  // ── Run now ──────────────────────────────────────────────────────────
  // Guarded by the same unsaved-edits dialog the chrome used: a re-enrich can
  // overwrite fields the operator is mid-edit on.
  const { guardIntent } = usePlaceContext();
  const [runPending, startRun] = useTransition();
  const [ranMode, setRanMode] = useState<ReenrichMode | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  const runNow = useCallback(
    (m: ReenrichMode) => {
      setRunError(null);
      setQueued(false);
      setRanMode(m);
      startRun(async () => {
        const r = await enrichPlace(place.id, m);
        if (!r.ok) {
          setRunError(r.error);
          return;
        }
        setQueued(true);
        // Reflect the queued run without waiting for the chrome's poll.
        setStatus((prev) => ({
          content_status: "generating",
          stage: m === "full" ? "research" : m,
          stage_status: "queued",
          error: null,
          last_enriched_at: prev?.last_enriched_at ?? null,
          updated_at: new Date().toISOString(),
        }));
      });
    },
    [place.id],
  );

  const auto = loaded?.everyDays != null;
  const running =
    status?.stage != null && !["done", "failed"].includes(status.stage);

  return (
    <SectionCard
      icon={<Sparkles className="h-4 w-4" />}
      tint="indigo"
      title="Enrichment"
      action={
        <span
          className={
            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
            (auto
              ? "bg-indigo-500/10 text-indigo-700"
              : "bg-muted text-muted-foreground")
          }
        >
          {auto ? `Every ${loaded?.everyDays}d` : "Manual"}
        </span>
      }
    >
      {loadError ? (
        <p className="text-destructive mt-5 text-xs leading-relaxed">
          Couldn&apos;t load the schedule: {loadError}
        </p>
      ) : loaded === null ? (
        <div className="mt-5">
          <Spinner label="Loading…" />
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-1.5">
            <span className="text-foreground/90 text-[13px] font-medium">
              Refresh this place
            </span>
            <div role="group" aria-label="Enrichment cadence" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CADENCES.map((c) => {
                const on = everyDays === c.value;
                return (
                  <button
                    key={c.label}
                    type="button"
                    disabled={pending}
                    aria-pressed={on}
                    title={c.hint}
                    onClick={() => setEveryDays(c.value)}
                    className={
                      "rounded-xl border px-2 py-2 text-[12px] font-semibold transition disabled:opacity-50 " +
                      (on
                        ? "border-primary/50 bg-primary/8 text-primary ring-primary/15 ring-2"
                        : "border-border/60 bg-muted/40 text-foreground/70 hover:border-foreground/25 hover:bg-muted/70")
                    }
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <span className="text-muted-foreground text-[11px] leading-relaxed">
              {CADENCES.find((c) => c.value === everyDays)?.hint}
            </span>
          </div>

          {everyDays !== null ? (
            <div className="mt-4 flex flex-col gap-1.5">
              <span className="text-foreground/90 text-[13px] font-medium">
                What each scheduled run redoes
              </span>
              <div role="group" aria-label="Scheduled enrichment mode" className="grid grid-cols-3 gap-2">
                {MODES.map((m) => {
                  const on = mode === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      disabled={pending}
                      aria-pressed={on}
                      title={m.hint}
                      onClick={() => setMode(m.value)}
                      className={
                        "rounded-xl border px-2 py-2 text-[12px] font-semibold transition disabled:opacity-50 " +
                        (on
                          ? "border-primary/50 bg-primary/8 text-primary ring-primary/15 ring-2"
                          : "border-border/60 bg-muted/40 text-foreground/70 hover:border-foreground/25 hover:bg-muted/70")
                      }
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <span className="text-muted-foreground text-[11px] leading-relaxed">
                {MODES.find((m) => m.value === mode)?.hint}
                {mode !== "full"
                  ? " Falls back to a full run if the stored research it reuses is missing."
                  : ""}
              </span>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ReadField label="Last enriched" boxed>
              {loaded.lastEnrichedAt
                ? formatAbsoluteUtc(loaded.lastEnrichedAt)
                : "Never"}
            </ReadField>
            <ReadField label="Next run" boxed>
              {running
                ? `Running now · ${status?.stage}`
                : loaded.nextAt
                  ? formatAbsoluteUtc(loaded.nextAt)
                  : "Not scheduled"}
            </ReadField>
          </div>

          <div className="border-border/60 mt-4 border-t pt-4">
            <span className="text-foreground/90 text-[13px] font-medium">
              Run now
            </span>
            <p className="text-muted-foreground mt-1.5 mb-2.5 text-[11px] leading-relaxed">A full run overwrites the profile with what it finds.</p>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  disabled={runPending || running}
                  title={m.hint}
                  onClick={() => {
                    if (guardIntent({ kind: "reenrich", run: () => runNow(m.value) })) return;
                    runNow(m.value);
                  }}
                  className="border-border/60 bg-muted/40 text-foreground/70 hover:border-foreground/25 hover:bg-muted/70 rounded-xl border px-2 py-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {runPending && ranMode === m.value ? "Queuing…" : m.label}
                </button>
              ))}
            </div>
            <p className="mt-2 min-h-4 text-[11px]" aria-live="polite">
              {runError ? (
                <span className="text-destructive">{runError}</span>
              ) : queued ? (
                <span className="text-muted-foreground">
                  Queued — the Enricher picks it up within seconds.
                </span>
              ) : running ? (
                <span className="text-muted-foreground">
                  A run is in flight; wait for it to finish.
                </span>
              ) : null}
            </p>
          </div>

          <SaveBar
            pending={pending}
            dirtyLabel="Enrichment · unsaved"
            dirty={dirty}
            ok={ok}
            error={error}
            onSave={save}
            onCancel={resetDraft}
          />
        </>
      )}
    </SectionCard>
  );
}
