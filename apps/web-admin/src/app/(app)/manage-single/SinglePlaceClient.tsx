"use client";

// Single Place — one place, three boxes. Find reads the one box two ways
// (a Google Place ID, or a name over the catalog); the place box is its
// identity, its twelve General State facts and its Crenup ladder; Crenup is
// the same five buttons Multiple Places has, aimed at this one place. Every
// write goes through the bulk page's server actions — one caller set, one
// behaviour — and everything that is not a Crenup write (fields, Active,
// Verified, Partnered) is a door to the business console, never a second
// editor here (MESITA-1588 · MESITA-2084).

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building,
  ExternalLink,
  Loader2,
  Play,
  Search,
} from "lucide-react";
import {
  createPlaceFromGooglePlaceId,
  deletePlace,
  enrichPlace,
  listAllPlaces,
  searchPlacesByGoogleIds,
  setPlaceListed,
  type PlaceHit,
} from "@/app/(app)/manage-multiple/actions";
import type { CrenupAction } from "@/app/(app)/manage-multiple/crenup-batch";
import { factOn } from "@/app/(app)/manage-multiple/mesita-search-facts";
import { CrenupLadder, StatePill } from "@/app/(app)/manage-multiple/PlaceFacts";
import { StateIcon, type BatchRowState } from "@/app/(app)/manage-multiple/StateIcon";
import {
  CopyIdButton,
  GroupLabel,
  ReadField,
  SectionCard,
} from "@/components/admin-ui/manage";
import type { PlaceLite, SearchErrorResponse, SearchResponse } from "@/lib/places-types";
import {
  GENERAL_STATE_FACTS,
  OPERATOR_PROMOTING_LABEL,
  operatorPromotingLevel,
  STATE_FACT_FALSE_TONE,
} from "@/lib/state-vocabulary";
import {
  businessConsolePlaceHref,
  classifyLookup,
  filterCatalog,
  googleMapsPlaceHref,
  MAX_NAME_MATCHES,
} from "./single-place-lookup";

export type View =
  | { kind: "matches"; query: string; hits: PlaceHit[] }
  | { kind: "place"; hit: PlaceHit }
  // A Google Place ID Mesita does not hold yet. `google` is what Google says
  // about it (one Place-ID lookup, which consumes the Discovery › Map gate
  // like any other), so Create is informed; null when that lookup failed.
  | { kind: "absent"; googleId: string; google: PlaceLite | null; note: string | null };

type Note = { state: BatchRowState; text: string };

/** Which button is mid-flight. `find` is the lookup; the rest are Crenup. */
type Busy = "find" | CrenupAction;

export function SinglePlaceClient() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<Busy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  // The catalog, read once per page life for name searches. A Crenup write
  // invalidates it, because a Create or a Delete changes what a name finds.
  const [catalog, setCatalog] = useState<PlaceHit[] | null>(null);

  const lookup = useMemo(() => classifyLookup(text), [text]);
  const isBusy = busy !== null;

  async function find() {
    if (isBusy || lookup.kind === "empty") return;
    setBusy("find");
    setError(null);
    setNote(null);
    try {
      if (lookup.kind === "google_place_id") {
        await findByGoogleId(lookup.id);
      } else {
        await findByName(lookup.query);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function findByGoogleId(googleId: string) {
    const r = await searchPlacesByGoogleIds([googleId]);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    const hit = r.data.find((p) => p.google_place_id === googleId) ?? r.data[0] ?? null;
    if (hit) {
      setView({ kind: "place", hit });
      return;
    }
    const peek = await peekGoogle(googleId);
    setView({ kind: "absent", googleId, google: peek.place, note: peek.note });
  }

  async function findByName(query: string) {
    let places = catalog;
    if (!places) {
      const r = await listAllPlaces();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      places = r.data.places;
      setCatalog(places);
    }
    const hits = filterCatalog(places, query);
    if (hits.length === 1) {
      setView({ kind: "place", hit: hits[0] });
      return;
    }
    setView({ kind: "matches", query, hits });
  }

  /** Re-read the place after a write: by its Google Place ID when it has
   *  one, else by walking the catalog for its Mesita id. Null when the read
   *  no longer finds it — the shape Delete leaves behind. */
  async function reread(hit: PlaceHit): Promise<PlaceHit | null> {
    if (hit.google_place_id) {
      const r = await searchPlacesByGoogleIds([hit.google_place_id]);
      if (!r.ok) throw new Error(r.error);
      return r.data.find((p) => p.id === hit.id) ?? null;
    }
    const r = await listAllPlaces();
    if (!r.ok) throw new Error(r.error);
    setCatalog(r.data.places);
    return r.data.places.find((p) => p.id === hit.id) ?? null;
  }

  async function run(action: CrenupAction) {
    if (isBusy || !view || view.kind === "matches") return;
    // Delete writes places.state = 'archived' — reversible only by a direct
    // DB edit, never by any button here. Same confirm as the bulk page.
    if (action === "delete") {
      const ok = window.confirm(
        "Delete this place? This archives it — no Undo in this console.",
      );
      if (!ok) return;
    }
    setBusy(action);
    setError(null);
    setNote({ state: "running", text: RUNNING_TEXT[action] });
    setCatalog(null);
    try {
      if (view.kind === "absent") {
        if (action !== "create") return;
        const r = await createPlaceFromGooglePlaceId(view.googleId);
        if (!r.ok) {
          setNote({ state: "error", text: r.error });
          return;
        }
        const found = await searchPlacesByGoogleIds([view.googleId]);
        const hit = found.ok
          ? (found.data.find((p) => p.google_place_id === view.googleId) ?? null)
          : null;
        if (hit) setView({ kind: "place", hit });
        setNote({
          state: r.alreadyExisted ? "existed" : "ok",
          text: r.alreadyExisted
            ? "Already on Mesita — skipped create"
            : r.enrichmentTriggered
              ? "Created · enrich queued"
              : "Created · enrich not queued",
        });
        return;
      }
      const { hit } = view;
      const outcome = await writeOne(hit, action);
      if (!outcome.ok) {
        setNote({ state: "error", text: outcome.error });
        return;
      }
      const next = await reread(hit);
      if (next) setView({ kind: "place", hit: next });
      setNote(outcome.note);
    } catch (err) {
      setNote({
        state: "error",
        text: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setBusy(null);
    }
  }

  const hit = view?.kind === "place" ? view.hit : null;

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        tint="sky"
        title="Find"
        subtitle="A Google Place ID looks it up by identity. Anything else searches the catalog by name, address or slug."
        icon={<Search className="h-4 w-4" />}
      >
        <form
          className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            void find();
          }}
        >
          <input
            id="single-place-lookup"
            aria-label="Google Place ID or place name"
            value={text}
            disabled={isBusy}
            onChange={(e) => setText(e.target.value)}
            placeholder="ChIJ… or a place name"
            autoComplete="off"
            className="border-border bg-background focus:border-foreground h-10 w-full rounded-xl border px-3 text-sm outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isBusy || lookup.kind === "empty"}
            className="bg-foreground text-background inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-50"
          >
            {busy === "find" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            {busy === "find" ? "Finding…" : "Find"}
          </button>
        </form>

        {error ? (
          <div className="border-destructive/40 bg-destructive/5 text-destructive mt-4 flex items-start gap-3 rounded-2xl border p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        {view?.kind === "matches" ? (
          <MatchList
            query={view.query}
            hits={view.hits}
            onPick={(picked) => setView({ kind: "place", hit: picked })}
          />
        ) : null}
      </SectionCard>

      {hit ? <PlaceCard hit={hit} /> : null}
      {view?.kind === "absent" ? <AbsentCard view={view} /> : null}

      {view && view.kind !== "matches" ? (
        <SectionCard
          tint="amber"
          title="Crenup"
          subtitle={
            view.kind === "absent"
              ? "CReate mints this place from its Google Place ID. Enrich and Update need it on Mesita first."
              : "ENrich fills it and is queued. List and Unlist toggle guest visibility, Delete archives — no Undo here."
          }
          icon={<Play className="h-4 w-4" />}
        >
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {view.kind === "absent" ? (
              <ActionButton
                label="Create"
                variant="primary"
                busy={busy === "create"}
                disabled={isBusy}
                onClick={() => void run("create")}
              />
            ) : (
              <>
                <ActionButton
                  label="Enrich"
                  variant="primary"
                  busy={busy === "enrich"}
                  disabled={isBusy}
                  onClick={() => void run("enrich")}
                />
                <ActionButton
                  label="List"
                  variant="secondary"
                  busy={busy === "list"}
                  disabled={isBusy || view.hit.listed}
                  onClick={() => void run("list")}
                />
                <ActionButton
                  label="Unlist"
                  variant="secondary"
                  busy={busy === "unlist"}
                  disabled={isBusy || !view.hit.listed}
                  onClick={() => void run("unlist")}
                />
                <ActionButton
                  label="Delete"
                  variant="destructive"
                  busy={busy === "delete"}
                  disabled={isBusy}
                  onClick={() => void run("delete")}
                />
              </>
            )}
            {note ? (
              <span className="inline-flex items-center gap-2 text-xs">
                <StateIcon state={note.state} />
                <span
                  className={
                    note.state === "error" ? "text-destructive" : "text-muted-foreground"
                  }
                >
                  {note.text}
                </span>
              </span>
            ) : null}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

const RUNNING_TEXT: Record<CrenupAction, string> = {
  create: "Creating…",
  enrich: "Queueing enrich…",
  list: "Listing…",
  unlist: "Unlisting…",
  delete: "Archiving…",
};

async function writeOne(
  hit: PlaceHit,
  action: CrenupAction,
): Promise<{ ok: true; note: Note } | { ok: false; error: string }> {
  if (action === "enrich") {
    const r = await enrichPlace(hit.id, "full");
    if (!r.ok) return { ok: false, error: r.error };
    return {
      ok: true,
      note: { state: "enriching", text: "Re-enrich from zero — Enricher 1–8 queued" },
    };
  }
  if (action === "list" || action === "unlist") {
    const listed = action === "list";
    const r = await setPlaceListed(hit.id, listed);
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, note: { state: "ok", text: listed ? "Listed on" : "Listed off" } };
  }
  if (action === "delete") {
    const r = await deletePlace(hit.id);
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, note: { state: "ok", text: "Archived" } };
  }
  // Create on a place that is already on Mesita: the bulk page's EF answers
  // 409 and the row reads "already on Mesita"; here the button is not drawn.
  return { ok: false, error: "Already on Mesita" };
}

/** One Place-ID lookup on Google, through the same route Google Search
 *  uses, so an ID Mesita does not hold still gets a name before Create. */
async function peekGoogle(
  googleId: string,
): Promise<{ place: PlaceLite | null; note: string | null }> {
  try {
    const res = await fetch("/api/bulk-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queries: [], placeIds: [googleId], maxResultsPerQuery: 1 }),
    });
    const data: SearchResponse | SearchErrorResponse = await res.json();
    if (!data.ok) return { place: null, note: data.error || `Google lookup failed (HTTP ${res.status})` };
    const place = data.uniquePlaces.find((p) => p.id === googleId) ?? data.uniquePlaces[0] ?? null;
    return {
      place,
      note: place ? null : "Google returned nothing for this ID — or the Discovery › Map floors removed it.",
    };
  } catch (err) {
    return { place: null, note: err instanceof Error ? err.message : String(err) };
  }
}

function MatchList({
  query,
  hits,
  onPick,
}: {
  query: string;
  hits: PlaceHit[];
  onPick: (hit: PlaceHit) => void;
}) {
  if (hits.length === 0) {
    return (
      <p className="text-muted-foreground mt-4 text-sm">
        Nothing on Mesita matches “{query}”. Paste its Google Place ID to create it.
      </p>
    );
  }
  return (
    <div className="border-border bg-card mt-4 overflow-hidden rounded-2xl border">
      <p className="text-muted-foreground border-border border-b px-4 py-2 type-label">
        {hits.length >= MAX_NAME_MATCHES
          ? `First ${MAX_NAME_MATCHES} matches — narrow the name`
          : `${hits.length} match${hits.length === 1 ? "" : "es"}`}
      </p>
      <ul className="divide-border/60 divide-y">
        {hits.map((h) => (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => onPick(h)}
              className="hover:bg-muted/50 flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition"
            >
              <Building className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{h.google_name || h.name}</span>
                {h.address ? (
                  <span className="text-muted-foreground block truncate type-label">
                    {h.address}
                  </span>
                ) : null}
              </span>
              <StatePill on={h.listed} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlaceCard({ hit }: { hit: PlaceHit }) {
  const rating =
    hit.google_stars_overall == null
      ? "—"
      : `${hit.google_stars_overall.toFixed(1)} · ${(hit.google_review_count ?? 0).toLocaleString()} reviews`;
  return (
    <SectionCard
      tint="violet"
      title={hit.google_name || hit.name}
      subtitle={hit.address ?? undefined}
      icon={<Building className="h-4 w-4" />}
      action={
        <a
          href={businessConsolePlaceHref(hit.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="border-border hover:border-foreground/40 inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition"
        >
          Open in business console
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      }
    >
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ReadField label="Mesita name">{hit.name}</ReadField>
        <ReadField label="Category">{hit.category_label ?? hit.category ?? "—"}</ReadField>
        <ReadField label="Zone">{hit.zone ?? "—"}</ReadField>
        <ReadField label="Google rating">{rating}</ReadField>
        <ReadField
          label="Mesita ID"
          labelRight={<CopyIdButton id={hit.id} />}
        >
          <span className="truncate font-mono text-xs">{hit.id}</span>
        </ReadField>
        <ReadField
          label="Google Place ID"
          labelRight={
            hit.google_place_id ? (
              <span className="text-muted-foreground flex items-center gap-3 type-label">
                <a
                  href={googleMapsPlaceHref(hit.google_place_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground inline-flex items-center gap-0.5 font-medium transition"
                >
                  Maps
                  <ExternalLink className="h-3 w-3" />
                </a>
                <CopyIdButton id={hit.google_place_id} />
              </span>
            ) : undefined
          }
        >
          <span className="truncate font-mono text-xs">{hit.google_place_id ?? "—"}</span>
        </ReadField>
      </div>

      <div className="mt-6">
        <GroupLabel>General States</GroupLabel>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {GENERAL_STATE_FACTS.map((f) => (
            <div
              key={f.key}
              className="border-border/60 flex items-center justify-between gap-3 border-b py-1.5 text-sm"
            >
              <dt className="text-foreground/90">{f.label}</dt>
              <dd className="shrink-0">
                {f.key === "promoting" ? (
                  <span className="tabular-nums">
                    {operatorPromotingLevel(hit.promoting_level)}{" "}
                    <span className="text-muted-foreground type-label">
                      {OPERATOR_PROMOTING_LABEL[operatorPromotingLevel(hit.promoting_level)]}
                    </span>
                  </span>
                ) : f.key === "requested" ? (
                  <span
                    className={
                      "type-label font-semibold tabular-nums " +
                      (hit.request_count > 0 ? "text-foreground" : "text-muted-foreground")
                    }
                  >
                    {hit.request_count}
                  </span>
                ) : (
                  <StatePill on={factOn(hit, f.key)} falseTone={STATE_FACT_FALSE_TONE[f.key]} />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {hit.enrich_crenup_labels.length > 0 ? (
        <div className="mt-6">
          <GroupLabel>Crenup</GroupLabel>
          <div className="mt-3">
            <CrenupLadder hit={hit} />
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

export function AbsentCard({ view }: { view: Extract<View, { kind: "absent" }> }) {
  const g = view.google;
  return (
    <SectionCard
      tint="violet"
      title={g?.displayName ?? "Not on Mesita"}
      subtitle={g?.formattedAddress ?? "Mesita holds no place with this Google Place ID."}
      icon={<Building className="h-4 w-4" />}
    >
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ReadField label="On Mesita">
          <StatePill on={false} />
        </ReadField>
        <ReadField label="Google rating">
          {g && g.rating != null
            ? `${g.rating.toFixed(1)} · ${(g.userRatingCount ?? 0).toLocaleString()} reviews`
            : "—"}
        </ReadField>
        <ReadField
          label="Google Place ID"
          labelRight={
            <span className="text-muted-foreground flex items-center gap-3 type-label">
              <a
                href={googleMapsPlaceHref(view.googleId)}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground inline-flex items-center gap-0.5 font-medium transition"
              >
                Maps
                <ExternalLink className="h-3 w-3" />
              </a>
              <CopyIdButton id={view.googleId} />
            </span>
          }
        >
          <span className="truncate font-mono text-xs">{view.googleId}</span>
        </ReadField>
      </div>
      {view.note ? (
        <p className="text-muted-foreground mt-4 text-xs">{view.note}</p>
      ) : null}
    </SectionCard>
  );
}

// Same three pills as the bulk page's Crenup box: primary = the one action
// that starts something, destructive = the one that cannot be undone here.
function ActionButton({
  label,
  variant,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  variant: "primary" | "secondary" | "destructive";
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const className =
    variant === "primary"
      ? "bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-50"
      : variant === "destructive"
        ? "border-destructive/40 text-destructive hover:bg-destructive/5 inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition disabled:opacity-50"
        : "border-border hover:border-foreground/40 inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition disabled:opacity-50";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
