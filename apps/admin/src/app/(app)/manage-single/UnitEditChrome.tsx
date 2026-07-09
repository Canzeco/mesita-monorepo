"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, ChevronDown, ImageOff, Loader2, Search, Sparkles } from "lucide-react";
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

  return (
    // Dark sticky chrome for contrast against the light page body. Uses
    // semantic foreground/background (not raw zinc/white) so the light theme
    // token contract still holds.
    <div className="bg-foreground text-background sticky top-0 z-30">
      <div className="flex items-center gap-3 px-4 py-2 sm:gap-4 sm:px-6 lg:px-8">
        <Link
          href="/manage-single/select"
          className="text-background/70 hover:bg-background/10 hover:text-background inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Switch unit</span>
        </Link>

        <span className="bg-background/20 h-4 w-px shrink-0" aria-hidden />

        <p
          className="max-w-[8rem] shrink-0 truncate text-sm font-semibold sm:max-w-[12rem] lg:max-w-none"
          title={place.name}
        >
          {place.name}
        </p>

        <nav
          role="tablist"
          aria-label="Unit sections"
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {UNIT_SECTIONS.map(({ id, label }) => {
            const href = unitSectionHref(projectId, id);
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={id}
                href={href}
                role="tab"
                aria-selected={active}
                className={
                  "inline-flex shrink-0 items-center rounded-md px-2.5 py-1.5 text-sm font-medium transition sm:px-3 " +
                  (active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-background/70 hover:bg-background/10 hover:text-background")
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <span className="bg-background/20 hidden h-4 w-px shrink-0 sm:block" aria-hidden />

        <ReEnrichButton projectId={projectId} />
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
    detail: "Research + analysis + contents. Refreshes Google spine, channels, reviews, images, copy — and re-fetches the phone (overrides).",
  },
  {
    mode: "analysis",
    label: "Analysis + contents",
    detail: "Re-ranks & rebuilds images, then re-persists — reusing the last gathered data (no re-gather). Phone/email untouched.",
  },
  {
    mode: "contents",
    label: "Contents only",
    detail: "Re-synthesises About / category / tags and re-persists — reusing the last gathered + analysis. Cheapest. Phone/email untouched.",
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
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition disabled:opacity-60 " +
          (state === "error"
            ? "text-red-300 hover:bg-red-500/20"
            : "text-secondary hover:bg-background/10")
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
        <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="border-border bg-card absolute right-0 z-40 mt-1 w-72 overflow-hidden rounded-lg border shadow-lg"
        >
          {REENRICH_MODES.map(({ mode, label, detail }) => (
            <button
              key={mode}
              type="button"
              role="menuitem"
              onClick={() => run(mode)}
              className="hover:bg-muted/60 block w-full px-3 py-2.5 text-left transition"
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
  const dim = size === "lg" ? "h-11 w-11 rounded-lg" : "h-8 w-8 rounded-md";
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
