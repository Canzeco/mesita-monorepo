"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import {
  getPlaceEnrichment,
  setPlaceEnrichmentSchedule,
  type AdminPlace,
  type PlaceEnrichmentSchedule,
  type PlaceEnrichmentStatus,
  type ReenrichMode,
} from "../actions";
import { useSectionDirty } from "../useSectionDirty";
import { ReadField, SaveBar, SectionCard, Spinner } from "../ui";
import { formatAbsoluteUtc } from "@/lib/format";

// Enrichment — WHEN this place re-enriches (MESITA-1148).
//
// Re-enrich in the unit chrome is "now". This is the other half: a cadence,
// so a place enriched in July doesn't still carry July's photos, hours and
// copy. The box writes places.enrich_every_days / enrich_mode / enrich_next_at
// through admin-web-set-place-enrichment; the pg_cron enqueuer
// (queue_due_place_enrichments, every 15 min) seeds place_research when a
// place comes due, and run_place_enrichment_stages stays the only dispatcher.
//
// Admin tab, not Settings: the Enricher is Mesita's own pipeline burning
// Mesita's own API budget. A business never schedules it.
const CADENCES: { value: number | null; label: string; hint: string }[] = [
  { value: null, label: "Manual only", hint: "Nothing runs unless you press Re-enrich." },
  { value: 7, label: "Weekly", hint: "For places whose hours and menu move constantly." },
  { value: 30, label: "Monthly", hint: "The sane default for a place that's live." },
  { value: 90, label: "Quarterly", hint: "Cheap upkeep for a stable listing." },
];

const MODES: { value: ReenrichMode; label: string; hint: string }[] = [
  { value: "full", label: "Full", hint: "Re-gathers everything: Google, channels, reviews, photos, then rewrites the copy. The only mode that refreshes facts." },
  { value: "analysis", label: "Images", hint: "Re-ranks and re-picks photos from what the last full run gathered. No new web calls." },
  { value: "contents", label: "Copy", hint: "Re-writes description, category and tags from stored research. Cheapest." },
];

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

  const auto = loaded?.everyDays != null;
  const running =
    status?.stage != null && !["done", "failed"].includes(status.stage);

  return (
    <SectionCard
      icon={<Sparkles className="h-4 w-4" />}
      tint="indigo"
      title="Enrichment"
      subtitle="When the Enricher refreshes this place on its own — Re-enrich above is the same pipeline, run now."
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
          <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
            Due places are picked up within 15 minutes, at most five at a time
            across all of Mesita — every run spends real Google, Apify,
            Perplexity and OpenAI budget, and the per-run cap only bounds one
            run. Caps and models live under Configurations → Enrichment.
          </p>

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
