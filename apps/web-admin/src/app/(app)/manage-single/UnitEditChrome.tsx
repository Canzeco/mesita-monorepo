"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  ImageOff,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  enrichPlace,
  getPlaceEnrichment,
  type AdminPlace,
  type PlaceEnrichmentStatus,
  type ReenrichMode,
} from "./actions";
import { UNIT_TAB_SECTIONS, unitSectionHref } from "./nav";
import { useUnitPlace } from "./UnitPlaceContext";

/** True while the Enricher pipeline is mid-flight.
 *  decision: Pato (MESITA-453) — Enriching = the WHOLE pipeline:
 *  research OR analysis OR contents. Never clear after research alone. */
function isEnriching(status: PlaceEnrichmentStatus | null): boolean {
  const stage = status?.stage ?? null;
  if (stage === "research" || stage === "analysis" || stage === "contents") {
    return true;
  }
  const contentStatus = status?.content_status ?? null;
  return contentStatus === "generating" || contentStatus === "queued";
}

// Status values that render the green "healthy" dot next to the place name;
// anything else (draft, paused, etc.) renders the amber dot.
const POSITIVE_STATUS_LABELS = new Set(["active", "published", "live", "ready"]);

/** Mesita name if set, else Google name (MESITA-917). */
function placeDisplayName(p: AdminPlace): string {
  const mesita = (p.name ?? "").trim();
  if (mesita) return mesita;
  const google = (p.google_name ?? "").trim();
  if (google) return google;
  return "(unnamed)";
}

export function UnitEditChrome({
  projectId,
  place,
}: {
  projectId: string;
  place: AdminPlace;
}) {
  const pathname = usePathname();
  // The discard guard and its dialog live on UnitPlaceContext so every exit
  // path is covered — including the cross-tab links inside PlaceSection, which
  // used to bypass the chrome-local guard entirely.
  const { isDirty, guardNav, guardIntent } = useUnitPlace();
  const heroPhoto = place.photos?.[0] ?? null;
  const statusLabel = place.status?.trim()
    ? place.status.charAt(0).toUpperCase() + place.status.slice(1)
    : null;
  const [enrichStatus, setEnrichStatus] = useState<PlaceEnrichmentStatus | null>(
    null,
  );
  const [enrichPollError, setEnrichPollError] = useState(false);
  const enriching = isEnriching(enrichStatus);
  const enrichFailed = enrichStatus?.stage === "failed";
  const enrichingRef = useRef(enriching);
  useEffect(() => {
    enrichingRef.current = enriching;
  }, [enriching]);

  // decision: MESITA-896 — enriching status lives HERE (next to Re-enrich).
  // Poll while enriching (~8s); back off to ~60s when idle; pause when the
  // document is hidden (E-R4).
  useEffect(() => {
    let alive = true;
    let timeoutId: number | null = null;

    const clear = () => {
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const load = () =>
      getPlaceEnrichment(projectId).then((r) => {
        if (!alive) return;
        if (!r.ok) {
          setEnrichPollError(true);
          return;
        }
        setEnrichPollError(false);
        setEnrichStatus(r.data.status);
      });

    const scheduleNext = () => {
      clear();
      if (!alive || document.hidden) return;
      const delay = enrichingRef.current ? 8_000 : 60_000;
      timeoutId = window.setTimeout(() => {
        void load().finally(() => {
          if (alive) scheduleNext();
        });
      }, delay);
    };

    void load().finally(() => {
      if (alive) scheduleNext();
    });

    const onVisibility = () => {
      if (document.hidden) {
        clear();
        return;
      }
      void load().finally(() => {
        if (alive) scheduleNext();
      });
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      alive = false;
      clear();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [projectId, enriching]);

  // Warn on tab close / refresh when Place edits are dirty.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const [reenrichPending, startReenrich] = useTransition();
  const [reenrichState, setReenrichState] = useState<"idle" | "done" | "error">(
    "idle",
  );
  const [reenrichError, setReenrichError] = useState<string | null>(null);
  const [ranMode, setRanMode] = useState<ReenrichMode | null>(null);

  const runReenrich = useCallback(
    (mode: ReenrichMode) => {
      setReenrichState("idle");
      setReenrichError(null);
      setRanMode(mode);
      startReenrich(async () => {
        const r = await enrichPlace(projectId, mode);
        if (r.ok) {
          setReenrichState("done");
          setEnrichStatus((prev) => ({
            content_status: "generating",
            stage:
              prev?.stage && prev.stage !== "done" && prev.stage !== "failed"
                ? prev.stage
                : "research",
            stage_status: "queued",
            error: null,
            last_enriched_at: prev?.last_enriched_at ?? null,
            updated_at: new Date().toISOString(),
          }));
        } else {
          setReenrichState("error");
          setReenrichError(r.error);
        }
      });
    },
    [projectId],
  );

  return (
    // Light sticky chrome — content area stays light; only the lateral menu is dark.
    <div className="border-border bg-card text-foreground sticky top-0 z-30 border-b shadow-sm">
      {/* Row 1 — identity + actions */}
      <div className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
        <UnitThumb photo={heroPhoto} name={placeDisplayName(place)} size="lg" />

        <div className="min-w-0 flex-1">
          <p
            className="font-display flex min-w-0 items-center gap-1.5 text-base font-semibold tracking-tight sm:text-lg"
            title={
              enriching
                ? `${placeDisplayName(place)} (Enriching)`
                : placeDisplayName(place)
            }
          >
            <span className="truncate">{placeDisplayName(place)}</span>
            {enriching ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-blue-600"
                aria-live="polite"
              >
                <span className="whitespace-nowrap">
                  {enrichStatus?.stage === "research" ||
                  enrichStatus?.stage === "analysis" ||
                  enrichStatus?.stage === "contents"
                    ? `(Enriching… ${enrichStatus.stage})`
                    : "(Enriching…)"}
                </span>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              </span>
            ) : enrichFailed ? (
              <span
                className="inline-flex shrink-0 items-center text-sm font-semibold text-red-600"
                title={enrichStatus?.error ?? "Enrichment failed"}
                aria-live="polite"
              >
                (Enrich failed)
              </span>
            ) : enrichPollError ? (
              <span
                className="text-muted-foreground inline-flex shrink-0 items-center text-xs font-medium"
                aria-live="polite"
              >
                (status unknown)
              </span>
            ) : null}
          </p>
          {(place.google_name ?? "").trim() &&
          (place.name ?? "").trim() &&
          (place.name ?? "").trim() !== (place.google_name ?? "").trim() ? (
            <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
              Google: {(place.google_name ?? "").trim()}
            </p>
          ) : null}
          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {statusLabel ? (
              <span className="text-foreground/80 inline-flex items-center gap-1.5 font-medium capitalize">
                <span
                  className={
                    "h-1.5 w-1.5 rounded-full " +
                    (POSITIVE_STATUS_LABELS.has(statusLabel.toLowerCase())
                      ? "bg-green-500"
                      : "bg-amber-500")
                  }
                  aria-hidden
                />
                {statusLabel}
              </span>
            ) : null}
            {place.category_label || place.category ? (
              <>
                {statusLabel ? (
                  <span className="bg-border h-1 w-1 rounded-full" aria-hidden />
                ) : null}
                <span className="truncate">
                  {place.category_label || place.category}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/manage-single/select"
            onClick={(e) => guardNav("/manage-single/select", e)}
            className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium transition sm:px-3.5"
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span className="hidden sm:inline">Switch place</span>
          </Link>
          <ReEnrichButton
            pending={reenrichPending}
            state={reenrichState}
            error={reenrichError}
            ranMode={ranMode}
            onPick={(mode) => {
              if (guardIntent({ kind: "reenrich", run: () => runReenrich(mode) }))
                return;
              runReenrich(mode);
            }}
          />
        </div>
      </div>

      {/* Row 2 — section nav (plain nav + aria-current; scrollbar visible so
          the fifth tab stays discoverable at ~375px — E-R6). */}
      <div className="border-border border-t px-2 sm:px-4 lg:px-6">
        <nav
          aria-label="Unit sections"
          className="flex items-stretch justify-center gap-0.5 overflow-x-auto"
        >
          {UNIT_TAB_SECTIONS.map(({ id, label, Icon, soon }) => {
            const href = unitSectionHref(projectId, id);
            const active = pathname === href || pathname.startsWith(`${href}/`);

            // Parked tab — not a link at all, so the section can't be reached
            // from the chrome (the route itself also serves the Soon page).
            if (soon) {
              return (
                <span
                  key={id}
                  aria-disabled
                  title={`${label} — coming soon`}
                  className="text-muted-foreground/50 relative inline-flex min-h-12 shrink-0 cursor-not-allowed items-center gap-2 px-3.5 text-sm font-semibold sm:min-h-[3.25rem] sm:px-4"
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  <span>{label}</span>
                  <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0 text-[9px] font-bold tracking-wider uppercase">
                    Soon
                  </span>
                </span>
              );
            }

            return (
              <Link
                key={id}
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  if (active) return;
                  guardNav(href, e);
                }}
                className={
                  "relative inline-flex min-h-12 shrink-0 items-center gap-2 px-3.5 text-sm font-semibold transition sm:min-h-[3.25rem] sm:px-4 " +
                  (active
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")
                }
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                <span>{label}</span>
                {active ? (
                  <span
                    className="bg-pink-gradient absolute inset-x-2 bottom-0 h-[3px] rounded-full sm:inset-x-3"
                    aria-hidden
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// The three re-enrich modes, widest → cheapest. The lighter two reuse the stored
// pipeline payloads, so they skip the expensive gather/analysis they don't re-run.
const REENRICH_MODES: {
  mode: ReenrichMode;
  label: string;
  detail: string;
}[] = [
  {
    mode: "full",
    label: "Full re-enrich",
    detail:
      "Research + analysis + contents. Refreshes Google spine, channels, reviews, images, copy — and re-fetches the phone (overrides).",
  },
  {
    mode: "analysis",
    label: "Analysis + contents",
    detail:
      "Re-ranks & rebuilds images, then re-persists — reusing the last gathered data (no re-gather). Phone/email untouched.",
  },
  {
    mode: "contents",
    label: "Contents only",
    detail:
      "Re-synthesises About / category / tags and re-persists — reusing the last gathered + analysis. Cheapest. Phone/email untouched.",
  },
];

// Manual re-enrich trigger. Ghost/secondary styling — expensive overwrite sits
// beside Switch place without competing as the primary chrome action (MESITA-547).
function ReEnrichButton({
  pending,
  state,
  error,
  ranMode,
  onPick,
}: {
  pending: boolean;
  state: "idle" | "done" | "error";
  error: string | null;
  ranMode: ReenrichMode | null;
  onPick: (mode: ReenrichMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const ranLabel = REENRICH_MODES.find((m) => m.mode === ranMode)?.label ?? "Re-enrich";

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        title={
          state === "error"
            ? (error ?? "Failed to queue enrichment")
            : "Re-run the Enricher pipeline for this place"
        }
        className={
          "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition disabled:opacity-60 sm:px-3.5 " +
          (state === "error"
            ? "border-red-300 bg-red-500/10 text-red-700 hover:bg-red-500/15"
            : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")
        }
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === "done" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">
          {pending ? "Queuing…" : state === "done" ? `Queued · ${ranLabel}` : "Re-enrich"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 opacity-80" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="border-border bg-card absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border shadow-lg"
        >
          {REENRICH_MODES.map(({ mode, label, detail }) => (
            <button
              key={mode}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPick(mode);
              }}
              className="hover:bg-muted/60 block w-full px-4 py-3 text-left transition"
            >
              <span className="text-foreground block text-sm font-medium">{label}</span>
              <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                {detail}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function UnitThumb({
  photo,
  name,
  size = "sm",
}: {
  photo: string | null;
  name: string;
  size?: "sm" | "lg";
}) {
  const dim =
    size === "lg" ? "h-11 w-11 rounded-xl shadow-sm" : "h-8 w-8 rounded-md";
  const icon = size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";

  if (!photo) {
    return (
      <div
        className={
          "border-border bg-muted/40 text-muted-foreground flex shrink-0 items-center justify-center border " +
          dim
        }
      >
        <ImageOff className={icon} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo}
      alt={name}
      className={"border-border shrink-0 border object-cover " + dim}
    />
  );
}
