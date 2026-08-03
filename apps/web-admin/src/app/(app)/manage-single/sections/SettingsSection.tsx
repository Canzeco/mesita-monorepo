"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Braces,
  ChevronDown,
  Fingerprint,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import {
  getPlaceEnrichment,
  listTeam,
  type AdminPlace,
  type PlaceEnrichmentStatus,
} from "../actions";
import { CheckPinCard } from "./CheckPinCard";
import { ManualPriorityCard } from "./ManualPriorityCard";
import { ReservationsCard } from "./ReservationsCard";
import { TeamSection } from "./TeamSection";
import { CopyIdButton, ReadField, SectionCard } from "../ui";
import { formatAbsoluteUtc } from "@/lib/format";

// Settings — the operator/meta cards pulled out of the Place tab plus the
// business Team card (MESITA-834; Team's own tab folded in per Pato, same
// day): Manual Priority (the one live editable per-place score), Team
// (managers + invites — no waiters, that identity is gone, MESITA-833),
// Ownership, Metadata (uid + live enriching status — keeps the 8s poll that
// used to live on Place), and Embeddings. Also the operator routing +
// gating knobs: Reservations channel (MESITA-837) and the optional Check PIN
// (MESITA-823). Profile content stays on Place.
export function SettingsSection({
  place,
  onSaved,
}: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
}) {
  const [enrichStatus, setEnrichStatus] = useState<PlaceEnrichmentStatus | null>(
    null,
  );
  // Owner emails (project_members role=owner) — null while loading.
  const [owners, setOwners] = useState<string[] | null>(null);
  const [ownersError, setOwnersError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const loadStatus = () => {
      getPlaceEnrichment(place.id).then((r) => {
        if (!alive) return;
        setEnrichStatus(r.ok ? r.data.status : null);
      });
    };
    loadStatus();
    // decision: Pato (MESITA-466) — Meta shows live enriching status; poll
    // while the tab is open (same cadence as UnitEditChrome).
    const pollId = window.setInterval(loadStatus, 8_000);
    listTeam(place.id).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setOwnersError(r.error);
        setOwners(null);
        return;
      }
      setOwnersError(null);
      setOwners(
        r.data.businesses
          .filter((m) => m.role === "owner")
          .map((m) => m.email ?? m.fullName ?? m.userId),
      );
    });
    return () => {
      alive = false;
      window.clearInterval(pollId);
    };
  }, [place.id]);

  return (
    // Same masonry as the Place tab — columns pack top-down (MESITA-399).
    <div className="columns-1 gap-4 pb-8 [&>section]:mb-4 [&>section]:break-inside-avoid [&>details]:mb-4 [&>details]:break-inside-avoid lg:columns-2 lg:gap-5 lg:pb-10 lg:[&>section]:mb-5 lg:[&>details]:mb-5">
      <ManualPriorityCard place={place} />
      <ReservationsCard place={place} onSaved={onSaved} />
      <CheckPinCard place={place} />
      <TeamSection place={place} />
      <OwnershipCard place={place} owners={owners} ownersError={ownersError} />
      <MetaCard place={place} enrichStatus={enrichStatus} />
      <EmbeddingsCard place={place} />
    </div>
  );
}

function OwnershipCard({
  place,
  owners,
  ownersError,
}: {
  place: AdminPlace;
  owners: string[] | null;
  ownersError: string | null;
}) {
  const verified = place.listing_type === "partner";
  return (
    <SectionCard
      icon={<ShieldCheck className="h-4 w-4" />}
      tint="emerald"
      title="Ownership"
      subtitle="Partner verification & owner accounts — manage in the Team card."
    >
      {/* One boxed field per row — same filled-input language as the
          editable cards. Verification is a single binary field; member
          management lives in the Team card beside this one. */}
      <div className="mt-5 grid gap-4">
        <ReadField label="Verification status" boxed>
          {verified ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
              <BadgeCheck className="h-3.5 w-3.5" />
              Verified
            </span>
          ) : (
            <span className="border-border/70 bg-card text-foreground/80 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold">
              Not verified
            </span>
          )}
        </ReadField>
        <ReadField label="Owners" boxed>
          {ownersError ? (
            <span className="text-destructive text-xs">{ownersError}</span>
          ) : owners === null ? (
            <span className="text-muted-foreground text-xs">Checking…</span>
          ) : owners.length === 0 ? (
            <span className="text-muted-foreground text-xs italic">
              No owners — nobody has claimed this place yet.
            </span>
          ) : (
            <ul className="flex w-full flex-col gap-1.5 py-2.5">
              {owners.map((email) => (
                <li key={email} className="flex min-w-0 items-center gap-2 text-sm">
                  <Mail className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{email}</span>
                </li>
              ))}
            </ul>
          )}
        </ReadField>
      </div>
    </SectionCard>
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

// place_research stage; falls back to the project's content_status when the
// place has no research row yet (created but never enriched).
function enrichmentBadge(
  s: PlaceEnrichmentStatus | null,
): { text: string; cls: string; spinning: boolean } {
  const stage = s?.stage ?? null;
  if (stage === "done")
    return { text: "Enriched", cls: "bg-green-500/10 text-green-600", spinning: false };
  if (stage === "failed")
    return { text: "Failed", cls: "bg-red-500/10 text-red-600", spinning: false };
  if (stage === "research" || stage === "analysis" || stage === "contents") {
    return {
      text: `Enriching… (${stage})`,
      cls: "bg-blue-500/10 text-blue-600",
      spinning: true,
    };
  }
  switch (s?.content_status) {
    case "ready":
      return { text: "Enriched", cls: "bg-green-500/10 text-green-600", spinning: false };
    case "generating":
    case "queued":
      return { text: "Enriching…", cls: "bg-blue-500/10 text-blue-600", spinning: true };
    case "failed":
      return { text: "Failed", cls: "bg-red-500/10 text-red-600", spinning: false };
    default:
      return { text: "Not enriched", cls: "bg-muted text-muted-foreground", spinning: false };
  }
}

// Metadata — UID + audit trail + enriching status. Open by default
// (MESITA-588) but still collapsible; stays a <details> so it can be tucked.
function MetaCard({
  place,
  enrichStatus,
}: {
  place: AdminPlace;
  enrichStatus: PlaceEnrichmentStatus | null;
}) {
  const by = lastUpdatedBy(place);
  const badge = enrichmentBadge(enrichStatus);
  const failed = enrichStatus?.stage === "failed";
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
            UID, audit trail & enriching status.
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
            <code className="min-w-0 truncate font-mono text-[11px]">
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
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold " +
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
        <ReadField label="Enriching status" boxed>
          <span
            className={
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold " +
              badge.cls
            }
          >
            {badge.spinning && (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
            )}
            {badge.text}
          </span>
        </ReadField>
        {failed && enrichStatus?.error ? (
          <p className="text-xs leading-snug text-red-600">
            Last enrichment failed: {enrichStatus.error}
          </p>
        ) : null}
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

// Embeddings — the Place Synthesis text + the vector it embeds to (MESITA-720).
// NOTE: the Place Synthesis is NOT the About/description. About is the
// human-readable profile copy; the synthesis is a separate, super-concise text
// purpose-built for semantic search. Written on create + on profile update.
// Open by default; collapsible like Metadata.
function EmbeddingsCard({ place }: { place: AdminPlace }) {
  const text = (place.embedding_source_text ?? "").trim();
  const vector = parseEmbeddingVector(place.embedding);
  const preview = vector?.slice(0, 24) ?? null;
  const dims = vector?.length ?? 0;
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
            Embeddings
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            The Place Synthesis — a super-concise text built FOR semantic search (not the
            human About), and the vector OpenAI embeds it into.
          </p>
        </div>
        <ChevronDown
          className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-border/60 flex flex-col gap-4 border-t px-5 pb-6 sm:px-6 sm:pb-8">
        <ReadField label="Place Synthesis as Text" boxed>
          {text ? (
            <span className="text-sm leading-relaxed whitespace-pre-wrap">{text}</span>
          ) : (
            <span className="text-muted-foreground text-xs italic">
              Not synthesized yet — written on create and when the profile changes.
            </span>
          )}
        </ReadField>
        <ReadField label="Place Synthesis as Embedding" boxed>
          {vector && preview ? (
            <span className="flex min-w-0 flex-col gap-1.5 py-0.5">
              <code className="text-muted-foreground break-all font-mono text-[10px] leading-snug">
                [{preview.map((n) => n.toFixed(4)).join(", ")}
                {dims > preview.length ? `, … +${dims - preview.length} dims` : ""}]
              </code>
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {dims}d · text-embedding-3-small
                {place.embedding_source_hash
                  ? ` · hash ${place.embedding_source_hash.slice(0, 8)}…`
                  : ""}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground text-xs italic">
              No vector yet — produced from the synthesis text above.
            </span>
          )}
        </ReadField>
      </div>
    </details>
  );
}
