"use client";

// Add place — ONE SEARCH BAR AND ONE LIST (MESITA-1850).
//
// Pato, 2026-09-14, on the form this replaced: *"that looks like shit. make
// full width bar with the actual word engine. display if the place is already
// on mesita or if its not. and put the shitty button to claim/verify all the
// fucking workflow."*
//
// WHAT WAS WRONG. It was a FORM: a 520px input capped by FORM_COLUMN_CLASS
// with a 12px "Place" eyebrow over it and a Cancel pill under it, on a
// 1700px screen. Picking a prediction collapsed the list, THEN ran the
// lookup, THEN rendered a card — three steps to learn one boolean ("is this
// on Mesita?") and a fourth to act on it.
//
// WHAT IT IS NOW. The bar is the page. Results are a full-width list, and
// every row carries the answer and the verb: the place, its address, its
// state, and Create · Claim · Open. Nothing collapses, nothing is picked,
// nothing waits for a second screen.
//
// KNOWING IS FREE, SO KNOW EAGERLY. `business-web-find-place` is a pure DB
// lookup on `google_place_id` — it never calls Google and bills nothing — so
// every prediction resolves in PARALLEL the moment the predictions land.
// That is the whole reason the state can live on the row instead of behind a
// click. If the two calls ever diverge in cost, batch the lookup rather than
// moving the fact back behind a step.
//
// EVERY RESULT KEEPS ITS OWN STATE. Lookups, pending flags and errors are
// keyed by Google place id, never by a single "selected" slot — two rows can
// be mid-claim and mid-error at once without either one stealing the other's
// spinner. A shared slot is how a list UI silently becomes a form again.
//
// THE SEARCH TOKEN IS PER QUERY. Google's autocomplete session token groups
// keystrokes into one billable search; it rotates when the query is cleared,
// not when a row is acted on, because acting on a row does not end the search
// — the operator may claim two places from one list.
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  addListedPlaceAction,
  createThenClaimAction,
} from "@/app/(shell)/actions/places";
import { rowStateForLookup, type RowState } from "@/lib/add-place-card";
import {
  apiPlacesAutocomplete,
  type PlacePrediction,
} from "@/lib/api/place-search";
import { apiLookupPlace } from "@/lib/api/verifications";
import { placeHref } from "@/lib/console-routes";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { errMsg } from "@/lib/utils";
import { AddPlaceHint, AddPlaceRow } from "./AddPlaceRow";

const SEARCH_DEBOUNCE_MS = 220;
const MIN_QUERY = 2;

function newSessionToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function AddPlaceForm({
  organizationId,
  canAdd,
  heldPlaceIds,
}: {
  organizationId: string;
  canAdd: boolean;
  heldPlaceIds: readonly string[];
}) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const held = useMemo(() => new Set(heldPlaceIds), [heldPlaceIds]);
  const sessionTokenRef = useRef(newSessionToken());

  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  /** Per Google place id. Absent = still checking; that is what the row's
   *  "Checking Mesita" line reads, so it is never a guess. */
  const [states, setStates] = useState<Record<string, RowState>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionPending, startAction] = useTransition();

  // ── The search ─────────────────────────────────────────────────────────
  // CLEARING IS THE HANDLER'S JOB, NOT THE EFFECT'S. Setting state
  // synchronously inside an effect cascades renders (react-hooks lint), so a
  // query that fell below the minimum is emptied where the operator emptied
  // it — in `onChange` — and this effect only ever runs a search.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const results = await apiPlacesAutocomplete(
          supabase,
          trimmed,
          sessionTokenRef.current,
        );
        if (cancelled) return;
        setPredictions(results);
        // KNOW EAGERLY: resolve every row's Mesita state in parallel. A
        // failed lookup leaves that row "Checking Mesita" rather than
        // asserting "Not on Mesita", which would offer Create for a place
        // that exists and 409 on the click.
        for (const p of results) {
          void (async () => {
            try {
              const lookup = await apiLookupPlace(supabase, p.placeId);
              if (cancelled) return;
              setStates((prev) => ({
                ...prev,
                [p.placeId]: rowStateForLookup(lookup, held),
              }));
            } catch {
              // Silent by design: the row keeps saying it is checking.
            }
          })();
        }
      } catch (err) {
        if (cancelled) return;
        setSearchError(errMsg(err, "Couldn't search places right now."));
        setPredictions([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, supabase, held]);

  // ── The two verbs ──────────────────────────────────────────────────────
  const goHeld = (placeId: string) => {
    router.push(placeHref(placeId));
    router.refresh();
  };
  const fail = (id: string, message: string) =>
    setRowErrors((prev) => ({ ...prev, [id]: message }));
  const clearError = (id: string) =>
    setRowErrors((prev) => {
      const { [id]: _gone, ...rest } = prev;
      return rest;
    });
  /** Re-ask this row after a partial failure, so the next click acts on what
   *  the catalogue says NOW rather than on what it said before the attempt. */
  const refresh = async (googlePlaceId: string) => {
    try {
      const lookup = await apiLookupPlace(supabase, googlePlaceId);
      setStates((prev) => ({
        ...prev,
        [googlePlaceId]: rowStateForLookup(lookup, held),
      }));
    } catch {
      // Leave the row's last known state; the error line already tells it.
    }
  };

  const onCreate = (p: PlacePrediction) => {
    clearError(p.placeId);
    setActingId(p.placeId);
    startAction(async () => {
      const result = await createThenClaimAction(p.placeId, organizationId);
      if (result.heldPlaceId) {
        goHeld(result.heldPlaceId);
        return;
      }
      // Someone created it between the lookup and the click, or the claim
      // half failed. Either way the row's state is stale — re-ask.
      if (result.alreadyExists || result.retryPlaceId) {
        if (result.error) fail(p.placeId, result.error);
        await refresh(p.placeId);
        return;
      }
      fail(p.placeId, result.error ?? "Couldn't create that place.");
    });
  };

  const onClaim = (p: PlacePrediction, placeId: string) => {
    clearError(p.placeId);
    setActingId(p.placeId);
    startAction(async () => {
      const result = await addListedPlaceAction(placeId, organizationId);
      if (result.heldPlaceId) {
        goHeld(result.heldPlaceId);
        return;
      }
      fail(p.placeId, result.error ?? "Couldn't claim that place.");
      await refresh(p.placeId);
    });
  };

  const tooShort = query.trim().length < MIN_QUERY;
  const nothingFound =
    !tooShort && !searching && !searchError && predictions.length === 0;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      {/* THE BAR IS THE PAGE. Full width, no label above it — the placeholder
          and the h1 already say what it searches. */}
      <div className="relative w-full">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2"
        />
        <input
          type="search"
          autoComplete="off"
          autoFocus
          value={query}
          aria-label="Search for a place"
          placeholder="Search for your place by name"
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            if (next.trim().length < MIN_QUERY) {
              // Back below the minimum: the list, its states and its errors
              // all belonged to a query that no longer exists.
              setPredictions([]);
              setStates({});
              setRowErrors({});
              setSearchError(null);
              // The session token groups keystrokes into ONE billable Google
              // search; a cleared box is a new search, a claimed row is not.
              sessionTokenRef.current = newSessionToken();
            }
          }}
          className="border-border bg-card focus:border-foreground/40 h-14 w-full rounded-2xl border pr-12 pl-11 text-base outline-none transition"
        />
        {searching && (
          <Loader2 className="text-muted-foreground pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 animate-spin motion-reduce:animate-none" />
        )}
      </div>

      {searchError ? <p className={ERROR_BOX_CLASS}>{searchError}</p> : null}

      {tooShort && !searchError ? <AddPlaceHint /> : null}

      {nothingFound ? (
        <p className="text-muted-foreground text-sm">
          No match for “{query.trim()}”. Try the name as it appears on the door.
        </p>
      ) : null}

      {predictions.length > 0 && (
        <ul aria-live="polite" className="flex w-full flex-col">
          {predictions.map((p) => (
            <AddPlaceRow
              key={p.placeId}
              prediction={p}
              state={states[p.placeId] ?? null}
              canAdd={canAdd}
              pending={actionPending && actingId === p.placeId}
              error={rowErrors[p.placeId] ?? null}
              onCreate={() => onCreate(p)}
              onClaim={(placeId) => onClaim(p, placeId)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
