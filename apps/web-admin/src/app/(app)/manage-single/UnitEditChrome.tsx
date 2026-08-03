"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { ConfirmDialog } from "./ui";

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

type PendingNav =
  | { kind: "href"; href: string }
  | { kind: "reenrich"; mode: ReenrichMode };

export function UnitEditChrome({
  projectId,
  place,
}: {
  projectId: string;
  place: AdminPlace;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isDirty, requestDiscard } = useUnitPlace();
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
  const [pendingNav, setPendingNav] = useState<PendingNav | null>(null);

  // decision: Pato (MESITA-451) — Enriching badge also lives next to the place
  // name in this chrome. Meta card shows enriching status too (MESITA-466).
  // Poll while open so the spinner clears when the pipeline finishes.
  useEffect(() => {
    let alive = true;
    const load = () => {
      getPlaceEnrichment(projectId).then((r) => {
        if (!alive) return;
        if (!r.ok) {
          setEnrichPollError(true);
          return;
        }
        setEnrichPollError(false);
        setEnrichStatus(r.data.status);
      });
    };
    load();
    const id = window.setInterval(load, 8_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [projectId]);

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

  const guardNav = useCallback(
    (href: string, e?: React.MouseEvent) => {
      if (!isDirty) return false;
      e?.preventDefault();
      setPendingNav({ kind: "href", href });
      return true;
    },
    [isDirty],
  );

  const guardReenrich = useCallback(
    (mode: ReenrichMode): boolean => {
      if (!isDirty) return false;
      setPendingNav({ kind: "reenrich", mode });
      return true;
    },
    [isDirty],
  );

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

  const confirmDiscard = () => {
    if (!pendingNav) return;
    const nav = pendingNav;
    setPendingNav(null);
    requestDiscard();
    if (nav.kind === "href") {
      router.push(nav.href);
      return;
    }
    runReenrich(nav.mode);
  };

  return (
    // Light sticky chrome — content area stays light; only the lateral menu is dark.
    <div className="border-border bg-card text-foreground sticky top-0 z-30 border-b shadow-sm">
      {/* Row 1 — identity + actions */}
      <div className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
        <UnitThumb photo={heroPhoto} name={place.name} size="lg" tone="onLight" />

        <div className="min-w-0 flex-1">
          <p
            className="font-display flex min-w-0 items-center gap-1.5 text-base font-semibold tracking-tight sm:text-lg"
            title={enriching ? `${place.name} (Enriching)` : place.name}
          >
            <span className="truncate">{place.name}</span>
            {enriching ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-blue-600"
                aria-live="polite"
              >
                <span className="whitespace-nowrap">(Enriching)</span>
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
              if (guardReenrich(mode)) return;
              runReenrich(mode);
            }}
          />
        </div>
      </div>

      {/* Row 2 — centered section tabs (shipped sections only — MESITA-547) */}
      <div className="border-border border-t px-2 sm:px-4 lg:px-6">
        <nav
          role="tablist"
          aria-label="Unit sections"
          className="flex items-stretch justify-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {UNIT_TAB_SECTIONS.map(({ id, label, Icon }) => {
            const href = unitSectionHref(projectId, id);
            const active = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={id}
                href={href}
                role="tab"
                aria-selected={active}
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

      <ConfirmDialog
        open={pendingNav != null}
        title="Unsaved Place edits"
        body={
          pendingNav?.kind === "reenrich" ? (
            <p>
              Re-enrich can overwrite fields you&apos;re editing. Discard unsaved
              changes and queue the Enricher, or cancel and save first.
            </p>
          ) : (
            <p>
              You have unsaved Place edits. Discard them to leave this page, or
              cancel and save first.
            </p>
          )
        }
        confirmLabel={
          pendingNav?.kind === "reenrich" ? "Discard & re-enrich" : "Discard & leave"
        }
        danger
        onConfirm={confirmDiscard}
        onCancel={() => setPendingNav(null)}
      />
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
  tone = "onLight",
}: {
  photo: string | null;
  name: string;
  size?: "sm" | "lg";
  /** onDark kept for any future dark surfaces; chrome + catalog use onLight. */
  tone?: "onLight" | "onDark";
}) {
  const dim =
    size === "lg" ? "h-11 w-11 rounded-xl shadow-sm" : "h-8 w-8 rounded-md";
  const icon = size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";
  const border =
    tone === "onDark" ? "border-background/20" : "border-border";
  const empty =
    tone === "onDark"
      ? "bg-background/10 text-background/50"
      : "bg-muted/40 text-muted-foreground";

  if (!photo) {
    return (
      <div
        className={
          "flex shrink-0 items-center justify-center border " + border + " " + empty + " " + dim
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
      className={"shrink-0 border object-cover " + border + " " + dim}
    />
  );
}
