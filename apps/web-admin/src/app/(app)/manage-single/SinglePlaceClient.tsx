"use client";

// Single Place › Find — the picker in front of the place surface
// (MESITA-2084, MESITA-2086). One box, read two ways: a Google Place ID looks
// the place up by its identity spine; anything else is a name search over the
// catalogue. A hit OPENS the place at /manage-single/<id>/profile — the
// business console's screens, generated into this app — rather than drawing a
// second card of its facts here. A name also searches Google beside the
// catalogue, and a Google place Mesita does not hold is added from that list
// (MESITA-2094). Google Autocomplete runs beside Text Search as its own list
// (MESITA-2116). Create and Add are the only writes this page makes itself.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building, ExternalLink, Loader2, Play, Search } from "lucide-react";
import {
  autocompleteGooglePlaces,
  createPlaceFromGooglePlaceId,
  listAllPlaces,
  searchPlacesByGoogleIds,
  type PlaceHit,
} from "@/app/(app)/manage-multiple/actions";
import { StatePill } from "@/app/(app)/manage-multiple/PlaceFacts";
import { StateIcon, type BatchRowState } from "@/app/(app)/manage-multiple/StateIcon";
import { CopyIdButton, ReadField, SectionCard } from "@/components/admin-ui/manage";
import { placeHref } from "@/lib/console-routes";
import type { PlaceLite, SearchErrorResponse, SearchResponse } from "@/lib/places-types";
import {
  GoogleMatchList,
  searchGoogleByName,
  type GoogleRowNote,
  type GoogleState,
} from "./GoogleMatches";
import {
  autocompleteToLite,
  classifyLookup,
  filterCatalog,
  googleMapsPlaceHref,
  googleOnMesita,
  MAX_NAME_MATCHES,
} from "./single-place-lookup";

export type View =
  | { kind: "matches"; query: string; hits: PlaceHit[] }
  // A Google Place ID Mesita does not hold yet. `google` is what Google says
  // about it (one Place-ID lookup, which consumes the Discovery › Map gate
  // like any other), so Create is informed; null when that lookup failed.
  | { kind: "absent"; googleId: string; google: PlaceLite | null; note: string | null };

type Note = { state: BatchRowState; text: string };

export function SinglePlaceClient() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"find" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  // The catalogue, read once per page life for name searches.
  const [catalog, setCatalog] = useState<PlaceHit[] | null>(null);
  // From Google, for the name in the matches view. `googleSeq` drops a reply
  // that lands after a newer Find; `added` (Google Place ID → Mesita id) and
  // `googleNotes` are this page's Adds.
  const [google, setGoogle] = useState<GoogleState | null>(null);
  // Autocomplete, the second Google list; `autoMesitaIds` are the rows the
  // EF resolved to a Mesita place (Google Place ID → Mesita id).
  const [auto, setAuto] = useState<GoogleState | null>(null);
  const [autoMesitaIds, setAutoMesitaIds] = useState<ReadonlyMap<string, string>>(new Map());
  const googleSeq = useRef(0);
  const [added, setAdded] = useState<ReadonlyMap<string, string>>(new Map());
  const [googleNotes, setGoogleNotes] = useState<Record<string, GoogleRowNote>>({});

  const lookup = useMemo(() => classifyLookup(text), [text]);
  const isBusy = busy !== null;
  // Google Place IDs this page knows Mesita holds: the catalogue's, plus
  // what Autocomplete resolved — one set, so a row's badge and its open path
  // read the same witnesses.
  const heldGoogleIds = useMemo(
    () =>
      new Set([
        ...(catalog ?? []).flatMap((p) => (p.google_place_id ? [p.google_place_id] : [])),
        ...autoMesitaIds.keys(),
      ]),
    [catalog, autoMesitaIds],
  );

  function open(placeId: string) {
    router.push(placeHref(placeId));
  }

  async function find() {
    if (isBusy || lookup.kind === "empty") return;
    setBusy("find");
    setError(null);
    setNote(null);
    googleSeq.current += 1;
    setGoogle(null);
    setAuto(null);
    setGoogleNotes({});
    try {
      if (lookup.kind === "google_place_id") await findByGoogleId(lookup.id);
      else await findByName(lookup.query);
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
      open(hit.id);
      return;
    }
    const peek = await peekGoogle(googleId);
    setView({ kind: "absent", googleId, google: peek.place, note: peek.note });
  }

  async function findByName(query: string) {
    // Both Google sources run beside the catalogue read, not after it, and
    // each lands on its own.
    const seq = googleSeq.current;
    setGoogle({ status: "loading" });
    setAuto({ status: "loading" });
    void searchGoogleByName(query).then((g) => {
      if (googleSeq.current === seq) setGoogle(g);
    });
    void searchGoogleAutocomplete(query).then((a) => {
      if (googleSeq.current !== seq) return;
      setAuto(a.google);
      setAutoMesitaIds(a.mesitaIds);
    });
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
    // Always the list, even for one catalogue match — the Google half is why
    // a name was typed.
    setView({ kind: "matches", query, hits: filterCatalog(places, query) });
  }

  /** A Google row: one Mesita holds opens the place (this page's Add, the
   *  Autocomplete resolve, then the catalogue, else the identity lookup); one
   *  it does not opens Not on Mesita with what Google already said, so Create
   *  spends no second call. An Autocomplete row (`peek`) said no rating, so
   *  it takes the identity lookup, which asks Google for the rest. */
  async function openGoogle(place: PlaceLite, peek = false) {
    if (isBusy) return;
    const known =
      added.get(place.id) ??
      autoMesitaIds.get(place.id) ??
      catalog?.find((p) => p.google_place_id === place.id)?.id;
    if (known) {
      open(known);
      return;
    }
    if (!peek && !googleOnMesita(place, heldGoogleIds, added)) {
      setNote(null);
      setView({ kind: "absent", googleId: place.id, google: place, note: null });
      return;
    }
    setBusy("find");
    setError(null);
    setNote(null);
    try {
      await findByGoogleId(place.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  /** Add mints a Google row in place and leaves the list up, so one search
   *  can add several. Same action as Create; the row then opens the place. */
  async function addFromGoogle(place: PlaceLite) {
    if (googleNotes[place.id]?.state === "running") return;
    setGoogleNotes((n) => ({ ...n, [place.id]: { state: "running", text: "Adding…" } }));
    let rowNote: GoogleRowNote;
    try {
      const r = await createPlaceFromGooglePlaceId(place.id);
      if (r.ok) {
        setAdded((m) => new Map(m).set(place.id, r.placeId));
        setCatalog(null);
        rowNote = {
          state: r.alreadyExisted ? "existed" : "ok",
          text: r.alreadyExisted
            ? "Already on Mesita"
            : r.enrichmentTriggered
              ? "Added · enrich queued"
              : "Added · enrich not queued",
        };
      } else {
        rowNote = { state: "error", text: r.error };
      }
    } catch (err) {
      rowNote = { state: "error", text: err instanceof Error ? err.message : "Unexpected error" };
    }
    setGoogleNotes((n) => ({ ...n, [place.id]: rowNote }));
  }

  async function create() {
    if (isBusy || view?.kind !== "absent") return;
    setBusy("create");
    setNote({ state: "running", text: "Creating…" });
    setCatalog(null);
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
          : r.enrichmentTriggered
            ? "Created · enrich queued — opening it"
            : "Created · enrich not queued — opening it",
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
        subtitle="A Google Place ID looks it up by identity. Anything else searches Mesita by name, address or slug, and Google Text Search and Autocomplete beside it. A hit opens the place."
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
          <>
            <ListHeading>On Mesita</ListHeading>
            <MatchList query={view.query} hits={view.hits} onPick={(h) => open(h.id)} />
            {google ? (
              <>
                <ListHeading>From Google · Text Search</ListHeading>
                <GoogleMatchList
                  query={view.query}
                  google={google}
                  onMesita={(p) => googleOnMesita(p, heldGoogleIds, added)}
                  notes={googleNotes}
                  disabled={isBusy}
                  onOpen={(p) => void openGoogle(p)}
                  onAdd={(p) => void addFromGoogle(p)}
                />
              </>
            ) : null}
            {auto ? (
              <>
                <ListHeading>From Google · Autocomplete</ListHeading>
                <GoogleMatchList
                  query={view.query}
                  source="autocomplete"
                  google={auto}
                  onMesita={(p) => googleOnMesita(p, heldGoogleIds, added)}
                  notes={googleNotes}
                  disabled={isBusy}
                  onOpen={(p) => void openGoogle(p, true)}
                  onAdd={(p) => void addFromGoogle(p)}
                />
              </>
            ) : null}
          </>
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

function ListHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground mt-5 type-label font-semibold tracking-wide uppercase">
      {children}
    </p>
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
      note: place ? null : "Google returned nothing for this ID — or the Discovery › Map floors removed it.",
    };
  } catch (err) {
    return { place: null, note: err instanceof Error ? err.message : String(err) };
  }
}

/** Google Autocomplete for a name, as a list Find can draw. One session
 *  token per Find — Google bills an Autocomplete session, not a keystroke,
 *  and Find asks once. Autocomplete reports no floors, so none are shown. */
async function searchGoogleAutocomplete(
  query: string,
): Promise<{ google: GoogleState; mesitaIds: ReadonlyMap<string, string> }> {
  const none = new Map<string, string>();
  try {
    const r = await autocompleteGooglePlaces(query, crypto.randomUUID());
    if (!r.ok) return { google: { status: "error", error: r.error }, mesitaIds: none };
    const mesitaIds = new Map(
      r.data.flatMap((h) => (h.mesitaId ? [[h.placeId, h.mesitaId] as const] : [])),
    );
    return {
      google: {
        status: "ok",
        result: {
          places: r.data.map(autocompleteToLite),
          minRating: 0,
          minUserRatingCount: 0,
          filteredOutCount: 0,
          mesitaLookupError: null,
        },
      },
      mesitaIds,
    };
  } catch (err) {
    return {
      google: { status: "error", error: err instanceof Error ? err.message : String(err) },
      mesitaIds: none,
    };
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
      <p className="text-muted-foreground mt-2 text-sm">
        Nothing on Mesita matches “{query}”. Add it from Google below.
      </p>
    );
  }
  return (
    <div className="border-border bg-card mt-2 overflow-hidden rounded-2xl border">
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
