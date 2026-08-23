"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, ImageOff, Loader2 } from "lucide-react";
import {
  getPlaceEnrichment,
  type AdminPlace,
  type PlaceEnrichmentStatus,
} from "./actions";
import { PLACE_TAB_SECTIONS, placeSectionHref } from "./nav";
import { usePlaceContext } from "./PlaceContext";

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

// LISTED, not "Active" (Pato live 2026-08-22). The header used to print
// `projects.status` capitalized — the raw column value shown to a human — and
// that is a second word for a fact Mesita already names. Listed is the word:
// StatusCard defines it as projects.status ∈ (active, lead), which is exactly
// what the consumer RLS policy projects_select_public_visible gates on. One
// word, one meaning; the header and the Status box now agree by construction
// because they read the same predicate.
//
// The old set also guarded "published" / "live" / "ready", three values this
// system has never written. Listing is binary here, so the derivation is too.
const LISTED_STATUSES = new Set(["active", "lead"]);

/** Is this place reachable by a guest on Mesita at all? */
function isListed(status: string | null | undefined): boolean {
  return LISTED_STATUSES.has((status ?? "").trim().toLowerCase());
}

/**
 * `name` is resolved in Postgres (generated: mesita_name → google_name) and is
 * NOT NULL, so there is nothing to coalesce here.
 */
function placeDisplayName(p: AdminPlace): string {
  return (p.name ?? "").trim() || "(unnamed)";
}

export function PlaceEditChrome({
  projectId,
  place,
}: {
  projectId: string;
  place: AdminPlace;
}) {
  const pathname = usePathname();
  // The discard guard and its dialog live on PlaceContext so every exit
  // path is covered — including the cross-tab links inside PlaceSection, which
  // used to bypass the chrome-local guard entirely.
  const { isDirty, guardNav } = usePlaceContext();
  const heroPhoto = place.photos?.[0] ?? null;
  const listed = isListed(place.status);
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

  // decision: MESITA-896 — the live enriching STATUS lives HERE, in the
  // chrome, so it is visible from every tab. The TRIGGER moved to Admin →
  // Enrichment (Pato, 2026-08-20): scheduling a refresh and running one now
  // are the same decision, so they belong in the same box.
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

  return (
    // Light sticky chrome — content area stays light; only the lateral menu is dark.
    <div className="border-border bg-card text-foreground sticky top-0 z-30 border-b shadow-card">
      {/* Row 1 — identity + actions */}
      <div className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
        <PlaceThumb photo={heroPhoto} name={placeDisplayName(place)} size="lg" />

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
          {/* Show what Google calls it only when an operator override hides it. */}
          {(place.mesita_name ?? "").trim() && (place.google_name ?? "").trim() ? (
            <p className="text-muted-foreground mt-0.5 truncate type-label">
              Google: {(place.google_name ?? "").trim()}
            </p>
          ) : null}
          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="text-foreground/80 inline-flex items-center gap-1.5 font-medium">
              <span
                className={
                  "h-1.5 w-1.5 rounded-full " +
                  (listed ? "bg-green-500" : "bg-amber-500")
                }
                aria-hidden
              />
              {listed ? "Listed" : "Not listed"}
            </span>
            {place.category_label || place.category ? (
              <>
                <span className="bg-border h-1 w-1 rounded-full" aria-hidden />
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
        </div>
      </div>

      {/* Row 2 — section nav (plain nav + aria-current; scrollbar visible so
          the fifth tab stays discoverable at ~375px — E-R6). */}
      <div className="border-border border-t px-2 sm:px-4 lg:px-6">
        <nav
          aria-label="Place sections"
          className="flex items-stretch justify-center gap-0.5 overflow-x-auto"
        >
          {PLACE_TAB_SECTIONS.map(({ id, label, Icon, soon }) => {
            const href = placeSectionHref(projectId, id);
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
                  <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0 type-meta font-bold tracking-wider uppercase">
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

export function PlaceThumb({
  photo,
  name,
  size = "sm",
}: {
  photo: string | null;
  name: string;
  size?: "sm" | "lg";
}) {
  const dim =
    size === "lg" ? "h-11 w-11 rounded-xl shadow-card" : "h-8 w-8 rounded-md";
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
