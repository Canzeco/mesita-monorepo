"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, ImageOff, Loader2 } from "lucide-react";
import {
  getPlaceEnrichment,
  getPlaceVerification,
  type AdminPlace,
  type PlaceEnrichmentStatus,
  type PlaceVerificationGlance,
} from "./actions";
import { PLACE_VERIFICATION_CHANGED } from "./verification-events";
import { PLACE_TAB_SECTIONS, placeSectionHref } from "./nav";
import { usePlaceContext } from "./PlaceContext";
import {
  generalHeaderFacts,
  isEnrichFailed,
  isEnriching,
  listedFromStatus,
} from "./place-header-status";
import { isMemberPlan } from "./sections/promo-state";
import { placeOperatorPromotingLevel } from "./sections/StatusCard";
import {
  intakeFunctionRows,
  type EnrichFunctionState,
} from "./sections/status-enrichment";
import { ENGINELESS_STATUS_FACT_KEYS } from "@/lib/status-vocabulary";

function headerChipClass(on: boolean | "unknown"): string {
  return (
    "inline-flex items-center rounded-full px-2 py-0.5 type-label font-semibold " +
    (on === "unknown"
      ? "bg-muted text-muted-foreground"
      : on
        ? "bg-emerald-500/10 text-emerald-700"
        : "bg-destructive/10 text-destructive")
  );
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
  const [verification, setVerification] = useState<
    PlaceVerificationGlance | null | undefined
  >(undefined);
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const [enrichStatus, setEnrichStatus] = useState<PlaceEnrichmentStatus | null>(
    null,
  );
  const [enrichPollError, setEnrichPollError] = useState(false);
  const enriching =
    isEnriching(enrichStatus) ||
    isEnriching({
      content_status:
        typeof place.content_status === "string" ? place.content_status : null,
      stage: null,
      stage_status: null,
      error: null,
      last_enriched_at: null,
      updated_at: null,
      serp_summary: null,
    });
  const enrichFailed = isEnrichFailed(enrichStatus);
  const enrichingRef = useRef(enriching);
  useEffect(() => {
    enrichingRef.current = enriching;
  }, [enriching]);

  useEffect(() => {
    let alive = true;
    const read = () => {
      getPlaceVerification(place.id).then((r) => {
        if (!alive) return;
        if (!r.ok) {
          setVerificationError(r.error);
          setVerification(null);
          return;
        }
        setVerificationError(null);
        setVerification(r.data);
      });
    };
    read();
    const onChanged = (event: Event) => {
      const id = (event as CustomEvent<{ placeId?: string }>).detail?.placeId;
      if (id && id !== place.id) return;
      read();
    };
    window.addEventListener(PLACE_VERIFICATION_CHANGED, onChanged);
    return () => {
      alive = false;
      window.removeEventListener(PLACE_VERIFICATION_CHANGED, onChanged);
    };
  }, [place.id]);

  const verified: boolean | "unknown" =
    verificationError || verification === undefined
      ? "unknown"
      : Boolean(verification?.verifiedByEmail);
  const seeded: boolean | "unknown" =
    typeof place.seeded === "boolean" ? place.seeded : "unknown";
  const listedFromRow = listedFromStatus(place.status);
  const facts = generalHeaderFacts({
    seeded: place.seeded,
    listed: listedFromRow === "unknown" ? place.listed : listedFromRow,
    requestCount: typeof place.request_count === "number" ? place.request_count : undefined,
    business_status: place.business_status,
    enriching,
    enrich_pulse: place.enrich_pulse,
    enrich_pulse_total: place.enrich_pulse_total,
    partner: isMemberPlan(place.plan),
    promotingLevel: placeOperatorPromotingLevel(place),
    verified,
    mesitaPay: typeof place.mesita_pay_enabled === "boolean" ? place.mesita_pay_enabled : undefined,
    credits: typeof place.credits_enabled === "boolean" ? place.credits_enabled : undefined,
  });
  const intakeRows = intakeFunctionRows(
    (place.enrich_functions ?? null) as
      | Record<string, EnrichFunctionState>
      | null,
    seeded,
  );

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
    <div className="border-border bg-card text-foreground sticky top-0 z-30 border-b">
      {/* Row 1 — identity + Switch place */}
      <div className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
        <PlaceThumb photo={heroPhoto} name={placeDisplayName(place)} size="lg" />

        <div className="min-w-0 flex-1">
          {/* The name is the name. Run state is a pill on the meta row —
              never a parenthetical on the title, never a raw pipeline
              stage (research / analysis / contents). Those live in
              Admin → Enrichment. Inter, not Fraunces — this chrome is
              identity, not a page title (Pato, Strana screenshot).

              THE HEADER IS NAME + STATUSES, NOTHING ELSE (Pato,
              2026-08-29). No category: it is an editable field, it lives
              on Profile, and an unset one printed "❓ Undefined" in the
              identity line — a placeholder wearing the same weight as
              the facts beside it. Never re-add it here. */}
          <p
            className="min-w-0 truncate text-lg font-semibold tracking-tight sm:text-xl"
            title={placeDisplayName(place)}
          >
            {placeDisplayName(place)}
          </p>
          <div className="mt-1 flex flex-col gap-1.5">
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              {enriching ? (
                <span
                  className="border-border bg-muted/70 text-foreground inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 type-label font-medium"
                  aria-live="polite"
                >
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  Enriching
                </span>
              ) : enrichFailed ? (
                <span
                  className="border-destructive/30 bg-destructive/5 text-destructive inline-flex items-center rounded-full border px-2 py-0.5 type-label font-medium"
                  title={enrichStatus?.error ?? "Enrichment failed"}
                  aria-live="polite"
                >
                  Enrich failed
                </span>
              ) : enrichPollError ? (
                <span
                  className="text-muted-foreground type-label font-medium"
                  aria-live="polite"
                >
                  Status unknown
                </span>
              ) : null}
            </div>
            <ul className="flex flex-wrap gap-1">
              {/* Engineless acceptance bits stay OFF the chip row: red here
                  means "owed and fixable", and nothing can fix them until
                  their engines exist (Pato gate 2026-08-29). The gateway /
                  Credits PRs lift this filter. Status box still shows them. */}
              {facts
                .filter((fact) =>
                  !(ENGINELESS_STATUS_FACT_KEYS as readonly string[]).includes(fact.key),
                )
                .map((fact) => (
                  <li key={fact.key}>
                    <span
                      className={headerChipClass(fact.on)}
                      aria-label={`${fact.label}: ${fact.on === "unknown" ? "unknown" : fact.on ? "yes" : "no"}`}
                    >
                      {fact.label}
                    </span>
                  </li>
                ))}
            </ul>
            <ul className="flex flex-wrap gap-1">
              {intakeRows.map((row) => (
                <li key={row.key}>
                  <span
                    className={headerChipClass(row.on)}
                    aria-label={`${row.label}: ${row.on ? "called" : "not called"}`}
                  >
                    {row.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/manage-single/select"
            onClick={(e) => guardNav("/manage-single/select", e)}
            className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition sm:px-3.5"
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
          className="flex items-stretch justify-center gap-1 overflow-x-auto sm:gap-2"
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
                  className="text-muted-foreground/50 relative inline-flex min-h-11 shrink-0 cursor-not-allowed items-center gap-2 px-3 text-sm font-medium sm:min-h-12 sm:px-4"
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  <span>{label}</span>
                  <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 type-meta font-bold tracking-wider uppercase">
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
                  "relative inline-flex min-h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium transition sm:min-h-12 sm:px-4 " +
                  (active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground")
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
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "lg"
      ? "h-12 w-12 rounded-xl"
      : size === "md"
        ? "h-10 w-10 rounded-lg"
        : "h-8 w-8 rounded-md";
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
