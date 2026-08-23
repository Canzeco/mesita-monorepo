"use client";

import { useEffect, useState } from "react";
import { Braces, ChevronDown, Fingerprint, Telescope } from "lucide-react";
import {
  getPlaceEnrichment,
  getPlaceVerification,
  type AdminPlace,
} from "../actions";
import { CopyIdButton, ReadField } from "../ui";
import { EnrichmentCard } from "./EnrichmentCard";
import { StatusCard } from "./StatusCard";
import { formatAbsoluteUtc } from "@/lib/format";

// Admin — the Mesita-internal tab (Pato, 2026-08-04).
//
// Admin — the Mesita-internal tab, FOUR boxes (Pato, MESITA-1161: "i don't
// want lots of fucking boxes"):
//
//   Status      the six status fields — seeded · listed · enriched · verified ·
//               partner · promoting — one row each, in one box.
//   Enrichment  when the Enricher refreshes this place, and the run-now button.
//   Embedding   the Place Synthesis text and the vector it becomes.
//   Metadata    every identifier and timestamp on the place. Nothing else in
//               the tab carries an id or a date — they all live here.
//
// The ownership-verification read is hoisted to this component because two
// boxes need it (Status for the boolean, Metadata for who and how) and it
// should cost one request, not two.
type Verification = {
  verifiedByEmail: string | null;
  decidedAt: string | null;
  method: string | null;
  decidedVia: string | null;
};

export function AdminSection({ place }: { place: AdminPlace }) {
  // undefined = in flight. Distinguished from null so a failed read can render
  // as "?" rather than a false "not verified".
  const [verification, setVerification] = useState<Verification | null | undefined>(
    undefined,
  );
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // No sync reset in the effect body (react-hooks/set-state-in-effect): the
  // shell remounts this tab when the operator switches place, so state starts
  // undefined on its own.
  useEffect(() => {
    let alive = true;
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
    return () => {
      alive = false;
    };
  }, [place.id]);

  return (
    // Same masonry as the Place tab — columns pack top-down (MESITA-399).
    <div className="columns-1 gap-4 pb-8 [&>section]:mb-4 [&>section]:break-inside-avoid [&>details]:mb-4 [&>details]:break-inside-avoid lg:columns-2 lg:gap-5 lg:pb-10 lg:[&>section]:mb-5 lg:[&>details]:mb-5">
      <StatusCard
        place={place}
        verification={verification}
        verificationError={verificationError}
      />
      {/* key remounts the loader when the operator switches places. */}
      <EnrichmentCard key={`enrich-${place.id}`} place={place} />
      <SerpSummaryCard place={place} />
      <EmbeddingCard place={place} />
      <MetaCard
        place={place}
        verification={verification}
        verificationError={verificationError}
      />
    </div>
  );
}

// No updated_by column exists, so attribute the last write by proximity: the
// Enricher's final write stamps enriched_at and bumps updated_at in the same
// statement — a tiny gap means the AI wrote last; anything later is a human
// edit (admin / business save).
function lastUpdatedBy(place: AdminPlace): "ai" | "human" | null {
  if (!place.updated_at) return null;
  if (!place.enriched_at) return "human";
  const updated = new Date(place.updated_at).getTime();
  const enriched = new Date(place.enriched_at).getTime();
  if (Number.isNaN(updated) || Number.isNaN(enriched)) return null;
  return updated - enriched <= 90_000 ? "ai" : "human";
}

// Metadata — EVERY identifier and timestamp on the place, and the only box in
// the tab that carries one (MESITA-1161: "there the metadata of everything.
// don't put other metadata in other boxes"). That includes the immutable
// ownership-verification record: who proved it, how, and when — Status says
// only whether it happened. Open by default (MESITA-588); collapsible.
function MetaCard({
  place,
  verification,
  verificationError,
}: {
  place: AdminPlace;
  verification: Verification | null | undefined;
  verificationError: string | null;
}) {
  const by = lastUpdatedBy(place);
  const verifiedBy = verification?.verifiedByEmail ?? null;
  return (
    <details
      className="border-border bg-card shadow-card group rounded-2xl border"
      open
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
        <span className="bg-muted text-muted-foreground inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <Fingerprint className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold tracking-tight">
            Metadata
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            UID & audit trail.
          </p>
        </div>
        <ChevronDown
          className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-border/60 flex flex-col gap-4 border-t px-5 pb-5 sm:px-6 sm:pb-6">
        <ReadField label="UID" boxed>
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <code className="min-w-0 truncate font-mono type-label">
              {place.id}
            </code>
            <span className="text-muted-foreground shrink-0 text-xs">
              <CopyIdButton id={place.id} />
            </span>
          </span>
        </ReadField>
        <ReadField label="Created at" boxed>
          {place.created_at ? formatAbsoluteUtc(place.created_at) : "—"}
        </ReadField>
        <ReadField label="Updated at" boxed>
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            {place.updated_at ? formatAbsoluteUtc(place.updated_at) : "—"}
            {by != null && (
              <span
                className={
                  "inline-flex items-center rounded-full px-2 py-0.5 type-meta font-semibold " +
                  (by === "ai"
                    ? "bg-sky-500/10 text-sky-700"
                    : "bg-card text-muted-foreground border-border/70 border")
                }
              >
                by {by === "ai" ? "Enricher (AI)" : "human"}
              </span>
            )}
          </span>
        </ReadField>
        <ReadField label="Ownership verified by" boxed>
          {verificationError ? (
            <span className="text-destructive text-xs">{verificationError}</span>
          ) : verification === undefined ? (
            <span className="text-muted-foreground text-xs">Checking…</span>
          ) : !verifiedBy ? (
            <span className="text-muted-foreground text-xs italic">
              Nobody has completed ownership verification yet.
            </span>
          ) : (
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate font-mono type-body">{verifiedBy}</span>
              <span className="text-muted-foreground type-label">
                {[
                  verification?.method?.replace(/_/g, " "),
                  verification?.decidedVia?.replace(/_/g, " "),
                  verification?.decidedAt
                    ? formatAbsoluteUtc(verification.decidedAt)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          )}
        </ReadField>
      </div>
    </details>
  );
}

function parseEmbeddingVector(raw: AdminPlace["embedding"]): number[] | null {
  if (Array.isArray(raw)) {
    const nums = raw.map((n) => Number(n));
    return nums.every((n) => Number.isFinite(n)) ? nums : null;
  }
  if (typeof raw !== "string" || !raw.trim()) return null;
  const inner = raw.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (!inner) return null;
  const nums = inner.split(",").map((s) => Number(s.trim()));
  return nums.every((n) => Number.isFinite(n)) ? nums : null;
}

// Embedding — the Place Synthesis text + the vector it embeds to (MESITA-720).
//
// WHICH ENTITY IS VECTORIZED (Pato asked, MESITA-1161): the PLACE, and only
// the place. `_shared/embeddings-vector.ts::placeEmbeddingFacts` builds the
// source from name · category · zone/city · address · price level · Description —
// all `places` columns — and the vector lands on `places.embedding` beside
// `embedding_source_text` / `embedding_source_hash`. The write goes through
// the `profiles` view because that is the write door, NOT because a profile
// or a project is what gets embedded: no plan, no rates, no listing_type, no
// status is in the vector. That is deliberate — commercial state changes
// weekly and would poison a semantic index that answers "what is this place
// like".
//
// NOTE: the Place Synthesis is NOT the Profile Description. The description is the
// human-readable profile copy; the synthesis is a separate, super-concise text
// purpose-built for semantic search. Written on create + on profile update.
// Open by default; collapsible like Metadata.
// Hard ceiling for Place Synthesis blurbs — must stay in lockstep with
// ENRICH_FIELD_LIMITS.embeddingSourceText (Atlas Config → Field limits).
const EMBEDDING_SOURCE_TEXT_MAX_WORDS = 60;

function EmbeddingCard({ place }: { place: AdminPlace }) {
  const summary = (place.embedding_source_text ?? "").trim();
  const wordCount = summary ? summary.split(/\s+/).filter(Boolean).length : 0;
  const vector = parseEmbeddingVector(place.embedding);
  const preview = vector?.slice(0, 24) ?? null;
  const dims = vector?.length ?? 0;
  // The resolved label is what actually reaches the source text: Postgres
  // generates places.name as coalesce(mesita_name, google_name), so an
  // operator override is already folded in by the time we embed.
  const resolvedName = (place.name ?? "").trim();
  const override = (place.mesita_name ?? "").trim();
  return (
    <details
      className="border-border bg-card shadow-card group rounded-2xl border"
      open
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
        <span className="bg-muted text-muted-foreground inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <Braces className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold tracking-tight">
            Embedding
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            One vector, over the name and the Semantic Summary.
          </p>
        </div>
        <ChevronDown
          className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-border/60 flex flex-col gap-4 border-t px-5 pb-6 sm:px-6 sm:pb-8">
        <ReadField label="Mesita Name" boxed>
          {resolvedName ? (
            <span className="flex min-w-0 flex-col gap-0.5 py-0.5">
              <span className="text-sm">{resolvedName}</span>
              <span className="text-muted-foreground type-label">
                {override
                  ? "Operator override — this is what gets embedded."
                  : "Following the Google name — no override set."}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground text-xs italic">
              Unnamed — nothing to embed.
            </span>
          )}
        </ReadField>
        <ReadField
          label={`Semantic Summary${summary ? ` \u00b7 ${wordCount}/${EMBEDDING_SOURCE_TEXT_MAX_WORDS} words` : ""}`}
          boxed
        >
          {summary ? (
            <span className="text-sm leading-relaxed whitespace-pre-wrap">{summary}</span>
          ) : (
            <span className="text-muted-foreground text-xs italic">
              Not written yet — produced on create and whenever the profile changes.
            </span>
          )}
        </ReadField>
        <ReadField label="Vector" boxed>
          {vector && preview ? (
            <code className="text-muted-foreground break-all font-mono type-meta leading-snug">
              [{preview.map((n) => n.toFixed(4)).join(", ")}
              {dims > preview.length ? `, \u2026 +${dims - preview.length} dims` : ""}]
            </code>
          ) : (
            <span className="text-muted-foreground text-xs italic">
              No vector yet — produced from the Semantic Summary above.
            </span>
          )}
        </ReadField>
        <ReadField label="Model" boxed>
          <span className="text-muted-foreground type-label tabular-nums">
            text-embedding-3-small{dims ? ` \u00b7 ${dims}d` : " \u00b7 1536d"} \u00b7 locked, not a knob
          </span>
        </ReadField>
        <ReadField label="Source hash" boxed>
          {place.embedding_source_hash ? (
            <span className="flex min-w-0 flex-col gap-0.5 py-0.5">
              <code className="min-w-0 truncate font-mono type-label">
                {place.embedding_source_hash}
              </code>
              <span className="text-muted-foreground type-label">
                The model is only called again when this goes stale.
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground text-xs italic">
              None — the place has never been embedded.
            </span>
          )}
        </ReadField>
      </div>
    </details>
  );
}

// SERP Summary — Agent X's web-grounded editorial read of the place, written at
// step 4 of the queue. It is one of the three enrichment texts, and the only
// one that never reaches a guest:
//
//   SERP Summary        soft context the PIPELINE reads (this box)
//   Profile Description places.description — the prose a GUEST reads
//   Semantic Summary    embedding_source_text — what the INDEX reads
//
// It gets its own box precisely because it is none of the other two. It grounds
// Agent Y's link selection at step 5 and the description at step 10, and it is
// NEVER a source of facts, ratings or prices — which is worth seeing plainly
// when a wrong fact shows up in a profile and you are hunting for its origin.
//
// It lives on the run (place_research.gathered), not on the place, so it comes
// from the enrichment EF rather than the place row.
function SerpSummaryCard({ place }: { place: AdminPlace }) {
  // The fetched summary carries the id it belongs to, so "have we loaded THIS
  // place" is DERIVED rather than a second state reset inside the effect —
  // React 19 flags a synchronous setState in an effect as a cascading render,
  // and switching places is exactly when that would fire.
  const [fetched, setFetched] = useState<
    { id: string; summary: string | null } | null
  >(null);

  useEffect(() => {
    let alive = true;
    getPlaceEnrichment(place.id).then((r) => {
      if (!alive) return;
      setFetched({
        id: place.id,
        summary: r.ok ? (r.data.status?.serp_summary ?? null) : null,
      });
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  const loaded = fetched?.id === place.id;
  const text = (loaded ? (fetched?.summary ?? "") : "").trim();
  return (
    <details
      className="border-border bg-card shadow-card group rounded-2xl border"
      open
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
        <span className="bg-muted text-muted-foreground inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <Telescope className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold tracking-tight">
            SERP Summary
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Soft context for the pipeline — never a source of facts.
          </p>
        </div>
        <ChevronDown
          className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-border/60 flex flex-col gap-4 border-t px-5 pb-6 sm:px-6 sm:pb-8">
        <ReadField label="Agent X · last run" boxed>
          {!loaded ? (
            <span className="text-muted-foreground text-xs italic">Loading…</span>
          ) : text ? (
            <span className="text-sm leading-relaxed whitespace-pre-wrap">{text}</span>
          ) : (
            <span className="text-muted-foreground text-xs italic">
              No SERP Summary on the last run — either the run did not buy it, or
              the web had nothing to say about this place.
            </span>
          )}
        </ReadField>
      </div>
    </details>
  );
}
