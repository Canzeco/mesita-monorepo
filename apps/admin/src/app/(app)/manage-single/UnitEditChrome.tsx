"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  ImageOff,
  Loader2,
  Sparkles,
} from "lucide-react";
import { enrichPlace, type AdminPlace, type ReenrichMode } from "./actions";
import { UNIT_SECTIONS, unitSectionHref } from "./nav";

export function currentUnitSection(pathname: string) {
  for (const { id } of UNIT_SECTIONS) {
    if (pathname.endsWith(`/${id}`) || pathname.includes(`/${id}/`)) {
      return id;
    }
  }
  return "place" as const;
}

export function UnitEditChrome({
  projectId,
  place,
}: {
  projectId: string;
  place: AdminPlace;
}) {
  const pathname = usePathname();
  const heroPhoto = place.photos?.[0] ?? null;
  const statusLabel = place.status?.trim()
    ? place.status.charAt(0).toUpperCase() + place.status.slice(1)
    : null;

  return (
    // Light sticky chrome — content area stays light; only the lateral menu is dark.
    <div className="border-border bg-card text-foreground sticky top-0 z-30 border-b shadow-sm">
      {/* Row 1 — identity + actions */}
      <div className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
        <UnitThumb photo={heroPhoto} name={place.name} size="lg" tone="onLight" />

        <div className="min-w-0 flex-1">
          <p
            className="font-display truncate text-base font-semibold tracking-tight sm:text-lg"
            title={place.name}
          >
            {place.name}
          </p>
          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {statusLabel ? (
              <span className="text-foreground/80 inline-flex items-center gap-1.5 font-medium capitalize">
                <span
                  className={
                    "h-1.5 w-1.5 rounded-full " +
                    (["active", "published", "live", "ready"].includes(
                      statusLabel.toLowerCase(),
                    )
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
                  {place.category_label ?? place.category}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/manage-single/select"
            className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium transition sm:px-3.5"
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span className="hidden sm:inline">Switch unit</span>
          </Link>
          <ReEnrichButton projectId={projectId} />
        </div>
      </div>

      {/* Row 2 — centered section tabs */}
      <div className="border-border border-t px-2 sm:px-4 lg:px-6">
        <nav
          role="tablist"
          aria-label="Unit sections"
          className="flex items-stretch justify-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {UNIT_SECTIONS.map(({ id, label, Icon, soon }) => {
            const href = unitSectionHref(projectId, id);
            const active = pathname === href || pathname.startsWith(`${href}/`);

            // Not-yet-built sections: non-navigable, dimmed, with a "Soon" badge.
            if (soon) {
              return (
                <span
                  key={id}
                  role="tab"
                  aria-disabled
                  title={`${label} — coming soon`}
                  className="text-muted-foreground/50 relative inline-flex min-h-12 shrink-0 cursor-not-allowed items-center gap-2 px-3.5 text-sm font-semibold sm:min-h-[3.25rem] sm:px-4"
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  <span>{label}</span>
                  <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase">
                    Soon
                  </span>
                </span>
              );
            }

            return (
              <Link
                key={id}
                href={href}
                role="tab"
                aria-selected={active}
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

// Manual re-enrich trigger. Re-queues the place through the Enricher pipeline at a
// chosen depth (full / analysis+contents / contents-only); it runs async, so the
// control just confirms the job was queued — progress shows in the Place tab's
// enrichment status. The lighter modes need a prior full run (EF rejects otherwise).
function ReEnrichButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [ranMode, setRanMode] = useState<ReenrichMode | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the menu on outside click / Escape.
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

  const run = (mode: ReenrichMode) => {
    setOpen(false);
    setState("idle");
    setError(null);
    setRanMode(mode);
    startTransition(async () => {
      const r = await enrichPlace(projectId, mode);
      if (r.ok) {
        setState("done");
      } else {
        setState("error");
        setError(r.error);
      }
    });
  };

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
          "inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition disabled:opacity-60 sm:px-3.5 " +
          (state === "error"
            ? "bg-red-500/15 text-red-700 hover:bg-red-500/25"
            : "bg-secondary text-secondary-foreground hover:opacity-90")
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
              onClick={() => run(mode)}
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
