"use client";

import { useEffect, useState } from "react";
import { Braces, ChevronDown, Fingerprint, Telescope } from "lucide-react";
import {
  getPlaceEnrichment,
  getPlaceVerification,
  type AdminPlace,
  type PlaceVerificationGlance,
} from "../actions";
import { CopyIdButton, ReadField } from "@/components/admin-ui/manage";
import { EnrichmentCard } from "./EnrichmentCard";
import { StatusCard } from "./StatusCard";
import { IntakeStatusCard } from "./IntakeStatusCard";
import { VerificationCard } from "./VerificationCard";
import { formatAbsoluteUtc } from "@/lib/format";

// Admin — the Mesita-internal tab (Pato, 2026-08-04).
//
// Admin — Status is TWO boxes:
//   Status      nine bools (`true`/`false`) + Requested `0…n` + Promoted `0|1|2`.
//               Enriching is live-run; Enriched is last-completed. The last
//               two bools are the settlement acceptance intent bits
//               (Mesita Pay · Mesita Yums) — Partner-tab toggles; engines still gate.
//   Intake      0. Seed · 1. Pulse · 2. Details · 3. Serp · 4. Links ·
//               5. Social · 6. Images · 7. Menu · 8. Reviews ·
//               9. Description · 10. Embedding — green called / yellow not.
// Then the rest:
//   Enrichment  queues the full Intaker process
//   Verification ownership proof (who / when / method + queue decide)
//   SERP / Embedding / Metadata (UID & audit — not ownership)
export function AdminSection({ place }: { place: AdminPlace }) {
  // undefined = in flight. Distinguished from null so a failed read can render
  // as "?" rather than a false "not verified".
  const [verification, setVerification] = useState<
    PlaceVerificationGlance | null | undefined
  >(undefined);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationEpoch, setVerificationEpoch] = useState(0);

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
  }, [place.id, verificationEpoch]);

  return (
    // Same masonry as the Place tab — columns pack top-down (MESITA-399).
    <div className="columns-1 gap-4 pb-8 [&>section]:mb-4 [&>section]:break-inside-avoid [&>details]:mb-4 [&>details]:break-inside-avoid lg:columns-2 lg:gap-5 lg:pb-10 lg:[&>section]:mb-5 lg:[&>details]:mb-5">
      <StatusCard
        place={place}
        verification={verification}
        verificationError={verificationError}
      />
      <IntakeStatusCard place={place} />
      {/* key remounts the loader when the operator switches places. */}
      <EnrichmentCard key={`enrich-${place.id}`} place={place} />
      <VerificationCard
        place={place}
        verification={verification}
        verificationError={verificationError}
        onChanged={() => setVerificationEpoch((n) => n + 1)}
      />
      <SerpSummaryCard place={place} />
      <EmbeddingCard place={place} />
      <MetaCard place={place} />
    </div>
  );
}

// No updated_by column exists, so attribute the last write by proximity: the
// Intaker's final write stamps enriched_at and bumps updated_at in the same
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

// Metadata — UID & audit trail only (MESITA-1320). Ownership proof lives
// on the Verification box. Open by default (MESITA-588); collapsible.
function MetaCard({ place }: { place: AdminPlace }) {
  const by = lastUpdatedBy(place);
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
                by {by === "ai" ? "Intaker (AI)" : "human"}
              </span>
            )}
          </span>
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

// Embedding — the Semantic Summary + the vector it embeds to (MESITA-720).
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
// NOTE: the Semantic Summary is NOT the Presentation. The Presentation is the
// human-readable profile copy a GUEST reads (`places.description`); the
// Semantic Summary is a separate, super-concise text purpose-built for
// semantic search, and the only one the INDEX reads. Two of the three
// enrichment texts named in `_shared/pulse-pieces.ts`, never collapsed.
// Written on create + on profile update. Open by default; collapsible like
// Metadata.
// Hard ceiling for the Semantic Summary — must stay in lockstep with
// ENRICH_FIELD_LIMITS.embeddingSourceText (Atlas Config → Field limits).
const EMBEDDING_SOURCE_TEXT_MAX_WORDS = 60;

function EmbeddingCard({ place }: { place: AdminPlace }) {
  const summary = (place.embedding_source_text ?? "").trim();
  const wordCount = summary ? summary.split(/\s+/).filter(Boolean).length : 0;
  const vector = parseEmbeddingVector(place.embedding);
  const preview = vector?.slice(0, 24) ?? null;
  const dims = vector?.length ?? 0;
  const nameVector = parseEmbeddingVector(place.name_embedding);
  const namePreview = nameVector?.slice(0, 24) ?? null;
  const nameDims = nameVector?.length ?? 0;
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
            Two vectors — Mesita Name, and the Semantic Summary.
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
                  ? "Operator override — this is what the Name vector embeds."
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
        <ReadField label="Name vector" boxed>
          {nameVector && namePreview ? (
            <code className="text-muted-foreground break-all font-mono type-meta leading-snug">
              [{namePreview.map((n) => n.toFixed(4)).join(", ")}
              {nameDims > namePreview.length
                ? `, \u2026 +${nameDims - namePreview.length} dims`
                : ""}]
            </code>
          ) : (
            <span className="text-muted-foreground text-xs italic">
              No name vector yet — produced from the Mesita Name above.
            </span>
          )}
        </ReadField>
        <ReadField label="Summary vector" boxed>
          {vector && preview ? (
            <code className="text-muted-foreground break-all font-mono type-meta leading-snug">
              [{preview.map((n) => n.toFixed(4)).join(", ")}
              {dims > preview.length ? `, \u2026 +${dims - preview.length} dims` : ""}]
            </code>
          ) : (
            <span className="text-muted-foreground text-xs italic">
              No summary vector yet — produced from the Semantic Summary above.
            </span>
          )}
        </ReadField>
        <ReadField label="Model" boxed>
          <span className="text-muted-foreground type-label tabular-nums">
            text-embedding-3-small{dims || nameDims ? ` \u00b7 ${dims || nameDims}d` : " \u00b7 1536d"} \u00b7 locked, not a knob
          </span>
        </ReadField>
        <ReadField label="Source hashes" boxed>
          {place.embedding_source_hash || place.name_embedding_hash ? (
            <span className="flex min-w-0 flex-col gap-1 py-0.5">
              {place.name_embedding_hash ? (
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-muted-foreground type-label">Name</span>
                  <code className="min-w-0 truncate font-mono type-label">
                    {place.name_embedding_hash}
                  </code>
                </span>
              ) : null}
              {place.embedding_source_hash ? (
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-muted-foreground type-label">Summary</span>
                  <code className="min-w-0 truncate font-mono type-label">
                    {place.embedding_source_hash}
                  </code>
                </span>
              ) : null}
              <span className="text-muted-foreground type-label">
                The model is only called again when the matching hash goes stale.
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
//   Presentation        places.description — the prose a GUEST reads
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
