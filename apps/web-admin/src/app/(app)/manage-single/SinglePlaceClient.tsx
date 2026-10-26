"use client";

// Single Place › Find — the picker in front of the place surface
// (MESITA-2084, MESITA-2086). One box, read two ways: a Google Place ID looks
// the place up by its identity spine; anything else is a word, and a word
// asks Mesita Name Search and Google, and draws one table of every place
// they returned. Opening the page lists every Mesita
// place and leaves the field open: no Google call, and the field is not an
// autocomplete (MESITA-2172). Enter is the deep search. A hit
// OPENS the place at
// /manage-single/<id>/profile — the place screens admin owns (MESITA-2115).
// Create (from a Google Place ID, or a table row) and Enrich (a held row)
// are the writes this page makes itself. Enrich is the one Enrich the Admin
// card runs: the whole pipeline, replacing what it finds (MESITA-2799).
// Reviews stay a separate reload.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building, ExternalLink, Loader2, Play, Search } from "lucide-react";
import {
  createPlaceFromGooglePlaceId,
  enrichPlace,
  searchPlacesByGoogleIds,
  type PlaceHit,
  type SuggestHit,
} from "@/app/(app)/manage-multiple/actions";
import { StatePill } from "@/app/(app)/manage-multiple/PlaceFacts";
import { StateIcon, type BatchRowState } from "@/app/(app)/manage-multiple/StateIcon";
import { BONE_CLASS, CopyIdButton, ReadField, SectionCard } from "@/components/admin-ui/manage";
import { placeTabHref } from "@/lib/place-tabs";
import type { PlaceLite, SearchErrorResponse, SearchResponse } from "@/lib/places-types";
import { GENERAL_STATE_FACTS } from "@/lib/state-vocabulary";
import {
  catalogueList,
  mergeFindResults,
  type FindResult,
  type FindRow,
  type SourceResult,
} from "./find-results";
import {
  loadCatalogSource,
  loadCatalogueWithTotal,
  searchAutocompleteSource,
  searchNameSource,
  searchTextSource,
} from "./find-sources";
import { DEFAULT_NAME_ADMIN, type NameAdminConfig } from "../filters-config/catalog";
import { FIND_TABLE_FRAME, FindResults, type RowNote } from "./FindResults";
import { classifyLookup, googleMapsPlaceHref } from "./single-place-lookup";

export type View =
  | { kind: "matches"; query: string; result: FindResult; variant: "search" | "catalogue" }
  // A Google Place ID Mesita does not hold yet. `google` is what Google says
  // about it (one Place-ID lookup, which consumes the Discovery › Map gate
  // like any other), so Create is informed; null when that lookup failed.
  | { kind: "absent"; googleId: string; google: PlaceLite | null; note: string | null };

type Note = { state: BatchRowState; text: string };

export function SinglePlaceClient({
  createOnOpen = true,
  find: findCaps = DEFAULT_NAME_ADMIN,
}: {
  /** Creation › "Create the profile on open · admin app" (MESITA-2298). */
  createOnOpen?: boolean;
  /** Discovery › Word by Admin (MESITA-2322). Mesita name rows are capped
   *  server-side; Autocomplete rows, Text Search rows and the empty query
   *  are read here. */
  find?: NameAdminConfig;
} = {}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"find" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  // The catalogue, read once per page life (and again after a Create).
  const [catalog, setCatalog] = useState<PlaceHit[] | null>(null);
  const [catalogTotal, setCatalogTotal] = useState<number | null>(null);
  // `findSeq` drops a reply that lands after a newer Find and keys the table,
  // so its Show more resets. `added` (Google Place ID → Mesita id) and
  // `rowNotes` are this page's Adds.
  const findSeq = useRef(0);
  const [tableKey, setTableKey] = useState(0);
  const [added, setAdded] = useState<ReadonlyMap<string, string>>(new Map());
  const [rowNotes, setRowNotes] = useState<Record<string, RowNote>>({});
  const [startingIds, setStartingIds] = useState<ReadonlySet<string>>(new Set());
  const [enrichingIds, setEnrichingIds] = useState<ReadonlySet<string>>(new Set());
  const [enrichErrors, setEnrichErrors] = useState<Readonly<Record<string, string>>>({});
  const enrichFlight = useRef(new Set<string>());

  const lookup = useMemo(() => classifyLookup(text), [text]);
  const isBusy = busy !== null;

  function open(placeId: string) {
    router.push(placeTabHref(placeId, "profile"));
  }

  async function find() {
    if (isBusy) return;
    setBusy("find");
    setError(null);
    setNote(null);
    findSeq.current += 1;
    setRowNotes({});
    try {
      if (lookup.kind === "empty") {
        if (findCaps.emptyQuery) await findCatalogue();
        else setView(null);
      }
      else if (lookup.kind === "google_place_id") await findByGoogleId(lookup.id);
      else await findByName(lookup.query);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  /** Empty Find: every Mesita place from the catalogue only (MESITA-2172). */
  async function findCatalogue() {
    const seq = findSeq.current;
    if (catalog && catalogTotal != null) {
      if (findSeq.current !== seq) return;
      setTableKey(seq);
      setView({
        kind: "matches",
        query: "",
        variant: "catalogue",
        result: catalogueList(catalog, catalogTotal),
      });
      return;
    }
    const all = await loadCatalogueWithTotal();
    if (findSeq.current !== seq) return;
    if (all.status === "error") {
      setError(`Catalogue failed: ${all.error}`);
      setView(null);
      return;
    }
    setCatalog(all.data.places);
    setCatalogTotal(all.data.total);
    setTableKey(seq);
    setView({
      kind: "matches",
      query: "",
      variant: "catalogue",
      result: catalogueList(all.data.places, all.data.total),
    });
  }

  useEffect(() => {
    findSeq.current += 1;
    if (findCaps.emptyQuery) void findCatalogue();
    // Mount only. The list loads without locking the field. Enter is the
    // deep search; an empty submit calls findCatalogue itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function findByGoogleId(googleId: string) {
    const r = await searchPlacesByGoogleIds([googleId]);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    const hit = r.data.find((p) => p.google_place_id === googleId) ?? r.data[0] ?? null;
    if (hit) {
      open(hit.id);
      return;
    }
    const peek = await peekGoogle(googleId);
    setView({ kind: "absent", googleId, google: peek.place, note: peek.note });
  }

  /** Name Search and Google, together. The table draws when both settle,
   *  so no row moves after it appears. The catalogue only says which hits
   *  Mesita already holds; it is not a search. */
  async function findByName(query: string) {
    const seq = findSeq.current;
    const catalogue: Promise<SourceResult<PlaceHit[]>> = catalog
      ? Promise.resolve({ status: "ok", data: catalog })
      : loadCatalogSource();
    const [all, name, textSearch, autocomplete] = await Promise.all([
      catalogue,
      searchNameSource(query),
      searchTextSource(query, findCaps.textCount),
      findCaps.autoCount > 0
        ? searchAutocompleteSource(query)
        : Promise.resolve<SourceResult<SuggestHit[]>>({ status: "ok", data: [] }),
    ]);
    if (findSeq.current !== seq) return;
    if (all.status === "ok") setCatalog(all.data);
    setTableKey(seq);
    setView({
      kind: "matches",
      query,
      variant: "search",
      result: mergeFindResults({
        catalogue: { status: "ok", data: [] },
        catalog: all.status === "ok" ? all.data : [],
        name,
        autocomplete,
        text: textSearch,
      }),
    });
  }

  /** A held row opens its place; held per Text Search's join alone (no id
   *  yet) takes the identity lookup, which opens it. */
  async function openRow(row: FindRow) {
    if (isBusy) return;
    const id = row.mesitaId ?? (row.googleId ? added.get(row.googleId) : undefined);
    if (id) {
      open(id);
      return;
    }
    if (!row.googleId) return;
    setBusy("find");
    setError(null);
    setNote(null);
    try {
      await findByGoogleId(row.googleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  /** A row's Create mints the place in place and leaves the table up, so one
   *  search can create several; the row then opens the place. Create builds
   *  the basic profile only: it never enriches. */
  async function addRow(row: FindRow) {
    const googleId = row.googleId;
    if (!googleId || rowNotes[googleId]?.state === "running") return;
    setRowNotes((n) => ({ ...n, [googleId]: { state: "running", text: "Creating…" } }));
    let rowNote: RowNote;
    try {
      const r = await createPlaceFromGooglePlaceId(googleId);
      if (r.ok) {
        setAdded((m) => new Map(m).set(googleId, r.placeId));
        setCatalog(null);
        setCatalogTotal(null);
        rowNote = {
          state: r.alreadyExisted ? "existed" : "ok",
          text: r.alreadyExisted ? "Already on Mesita" : "Created · not enriched",
        };
      } else {
        rowNote = { state: "error", text: r.error };
      }
    } catch (err) {
      rowNote = { state: "error", text: err instanceof Error ? err.message : "Unexpected error" };
    }
    setRowNotes((n) => ({ ...n, [googleId]: rowNote }));
  }

  /** With Create-on-open on (Configurations › Creation), a Google-only row's
   *  name creates the place and opens it, the way a guest's tap does
   *  (MESITA-2298). The EF re-checks the switch. */
  async function openGoogleRow(row: FindRow) {
    const googleId = row.googleId;
    if (!googleId || isBusy || rowNotes[googleId]?.state === "running") return;
    setRowNotes((n) => ({ ...n, [googleId]: { state: "running", text: "Opening…" } }));
    let rowNote: RowNote;
    let openId: string | null = null;
    try {
      const r = await createPlaceFromGooglePlaceId(googleId, { onOpen: true });
      if (r.ok) {
        setAdded((m) => new Map(m).set(googleId, r.placeId));
        setCatalog(null);
        setCatalogTotal(null);
        openId = r.placeId;
        rowNote = {
          state: r.alreadyExisted ? "existed" : "ok",
          text: r.alreadyExisted ? "Already on Mesita" : "Created · not enriched",
        };
      } else {
        rowNote = { state: "error", text: r.error };
      }
    } catch (err) {
      rowNote = { state: "error", text: err instanceof Error ? err.message : "Unexpected error" };
    }
    setRowNotes((n) => ({ ...n, [googleId]: rowNote }));
    if (openId) open(openId);
  }

  /** Same Enrich as the Admin card. Starting… while the call is in flight,
   *  then Enriching. A second click does nothing. Failure puts the verbs back. */
  async function enrichRow(row: FindRow) {
    const id = row.mesitaId ?? (row.googleId ? added.get(row.googleId) : undefined);
    if (!id || enrichFlight.current.has(id)) return;
    if (row.placeHit?.enriching === true || enrichingIds.has(id)) return;
    if (row.placeHit?.enriched) {
      const ok = window.confirm("This place is already enriched. Run Enrich again?");
      if (!ok) return;
    }
    enrichFlight.current.add(id);
    setStartingIds((s) => new Set(s).add(id));
    setEnrichErrors((e) => {
      if (!(id in e)) return e;
      const next = { ...e };
      delete next[id];
      return next;
    });
    let failed: string | null = null;
    try {
      const r = await enrichPlace(id);
      if (!r.ok) failed = r.error;
    } catch (err) {
      failed = err instanceof Error ? err.message : "Unexpected error";
    } finally {
      enrichFlight.current.delete(id);
      setStartingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
    if (failed) {
      const message = failed;
      setEnrichErrors((e) => ({ ...e, [id]: message }));
      return;
    }
    setEnrichingIds((s) => new Set(s).add(id));
  }

  async function create() {
    if (isBusy || view?.kind !== "absent") return;
    setBusy("create");
    setNote({ state: "running", text: "Creating…" });
    setCatalog(null);
    setCatalogTotal(null);
    try {
      const r = await createPlaceFromGooglePlaceId(view.googleId);
      if (!r.ok) {
        setNote({ state: "error", text: r.error });
        return;
      }
      setNote({
        state: r.alreadyExisted ? "existed" : "ok",
        text: r.alreadyExisted
          ? "Already on Mesita — opening it"
          : "Created · not enriched — opening it",
      });
      open(r.placeId);
    } catch (err) {
      setNote({
        state: "error",
        text: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        tint="sky"
        title="Find"
        subtitle="The list is every place Mesita holds. Press Enter to search. A name asks Google. A Google Place ID opens or creates."
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
            disabled={isBusy}
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

        {view == null ? <CatalogueSkeleton /> : null}

        {view?.kind === "matches" ? (
          <FindResults
            key={tableKey}
            query={view.query}
            result={view.result}
            added={added}
            notes={rowNotes}
            disabled={isBusy}
            variant={view.variant}
            onOpen={(row) => void openRow(row)}
            onOpenGoogle={createOnOpen ? (row) => void openGoogleRow(row) : undefined}
            onAdd={(row) => void addRow(row)}
            onEnrich={(row) => void enrichRow(row)}
            startingIds={startingIds}
            enrichingIds={enrichingIds}
            enrichErrors={enrichErrors}
          />
        ) : null}
      </SectionCard>

      {view?.kind === "absent" ? (
        <AbsentCard
          view={view}
          busy={busy === "create"}
          disabled={isBusy}
          note={note}
          onCreate={() => void create()}
        />
      ) : null}
    </div>
  );
}

/** The catalogue while it loads, laid out as FindResults lays it out (Pato,
 *  MESITA-2701: "the placeholders must be similar to the page you are
 *  loading, like the sizes"): the same card (FIND_TABLE_FRAME), bled to the
 *  edges on a phone,
 *  its 11px head band, then rows of the Place cell (the 14px name over the
 *  11px address) and the seven state pills. From 640px the 9rem On column
 *  leads each row; under that its pill sits above the name. The table runs
 *  wider than the pane, so the row end (the action) is off screen here as
 *  it is there. It was three grey bars. */
function CatalogueSkeleton() {
  const held = "hidden w-36 shrink-0 justify-center px-3 py-3 sm:flex";
  const place = "w-[60vw] shrink-0 px-4 py-3 sm:w-[280px]";
  const state = "flex w-24 shrink-0 justify-center px-3 py-3";
  return (
    <div
      aria-busy="true"
      aria-label="Loading Mesita places"
      className={FIND_TABLE_FRAME}
    >
      <div aria-hidden className="bg-muted/30 type-label flex">
        <div className={held}>
          <div className="flex h-[1lh] items-center">
            <div className={`${BONE_CLASS} h-2.5 w-5`} />
          </div>
        </div>
        <div className={place}>
          <div className="flex h-[1lh] items-center">
            <div className={`${BONE_CLASS} h-2.5 w-10`} />
          </div>
        </div>
        {GENERAL_STATE_FACTS.map((f) => (
          <div key={f.key} className={state}>
            <div className="flex h-[1lh] items-center">
              <div className={`${BONE_CLASS} h-2.5 w-14`} />
            </div>
          </div>
        ))}
      </div>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} aria-hidden className="border-border/60 flex border-t">
          <div className={held}>
            <div className={`${BONE_CLASS} h-5 w-14 rounded-full`} />
          </div>
          <div className={place}>
            <div className={`${BONE_CLASS} mb-1 h-5 w-14 rounded-full sm:hidden`} />
            <div className="flex h-5 items-center">
              <div className={`${BONE_CLASS} h-3.5 w-40 max-w-full`} />
            </div>
            <div className="type-label flex h-[1lh] items-center">
              <div className={`${BONE_CLASS} h-2.5 w-52 max-w-full`} />
            </div>
          </div>
          {GENERAL_STATE_FACTS.map((f) => (
            <div key={f.key} className={state}>
              <div className={`${BONE_CLASS} h-5 w-8 rounded-full`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
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
      note: place ? null : "Google returned nothing for this ID — or Discovery's place rules (Mesita's place types, a stored Google floor) removed it.",
    };
  } catch (err) {
    return { place: null, note: err instanceof Error ? err.message : String(err) };
  }
}

export function AbsentCard({
  view,
  busy = false,
  disabled = false,
  note = null,
  onCreate,
}: {
  view: Extract<View, { kind: "absent" }>;
  busy?: boolean;
  disabled?: boolean;
  note?: Note | null;
  onCreate?: () => void;
}) {
  const g = view.google;
  return (
    <SectionCard
      tint="violet"
      title={g?.displayName ?? "Not on Mesita"}
      subtitle={g?.formattedAddress ?? "Mesita holds no place with this Google Place ID."}
      icon={<Building className="h-4 w-4" />}
      action={
        <button
          type="button"
          onClick={onCreate}
          disabled={disabled}
          className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Create
        </button>
      }
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
      <p className="text-muted-foreground mt-4 text-xs">
        Create mints the place from its Google Place ID and opens it. Enrich and
        the rest live on the place.
        {view.note ? ` ${view.note}` : ""}
      </p>
      {note ? (
        <p className="mt-3 inline-flex items-center gap-2 text-xs">
          <StateIcon state={note.state} />
          <span className={note.state === "error" ? "text-destructive" : "text-muted-foreground"}>
            {note.text}
          </span>
        </p>
      ) : null}
    </SectionCard>
  );
}
