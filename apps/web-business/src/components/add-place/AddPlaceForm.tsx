"use client";

// Add place — search Google, then Create (not on Mesita) or Add (on Mesita).
// Mutations go through server actions. Suggest + lookup stay in the browser.
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  addListedPlaceAction,
  createThenClaimAction,
} from "@/app/(shell)/actions/places";
import { cardForLookup, type CeremonyCard } from "@/lib/add-place-card";
import {
  apiPlacesAutocomplete,
  type PlacePrediction,
} from "@/lib/api/place-search";
import { apiLookupPlace } from "@/lib/api/verifications";
import { placeHref } from "@/lib/console-routes";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  ERROR_BOX_CLASS,
  FORM_COLUMN_CLASS,
  GHOST_PILL_BUTTON_CLASS,
  INPUT_CLASS,
} from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";
import {
  AddListedPlaceCard,
  CreatePlaceCard,
  OpenHeldPlaceCard,
  PartnerOtherCard,
} from "./AddPlaceCards";

const SEARCH_DEBOUNCE_MS = 220;

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
  cancelHref,
}: {
  organizationId: string;
  canAdd: boolean;
  heldPlaceIds: readonly string[];
  cancelHref: string;
}) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const held = useMemo(() => new Set(heldPlaceIds), [heldPlaceIds]);
  const listId = useId();
  const sessionTokenRef = useRef(newSessionToken());

  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlacePrediction | null>(null);
  const [card, setCard] = useState<CeremonyCard | null>(null);
  const [lookupPending, startLookup] = useTransition();
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [actionPending, startAction] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (selected || query.trim().length < 2) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const results = await apiPlacesAutocomplete(
          supabase,
          query,
          sessionTokenRef.current,
        );
        if (!cancelled) {
          setPredictions(results);
          setHighlight(0);
          setOpen(results.length > 0);
        }
      } catch (err) {
        if (!cancelled) {
          setSearchError(errMsg(err, "Couldn't search places right now."));
          setPredictions([]);
          setOpen(false);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, selected, supabase]);

  const applyLookup = (prediction: PlacePrediction) => {
    setLookupError(null);
    startLookup(async () => {
      try {
        const lookup = await apiLookupPlace(supabase, prediction.placeId);
        setCard(cardForLookup(lookup, prediction, held));
      } catch (err) {
        setLookupError(errMsg(err, "Couldn't look up that place."));
        setCard(null);
      }
    });
  };

  const pick = (prediction: PlacePrediction) => {
    setSelected(prediction);
    setQuery(
      prediction.secondaryText
        ? `${prediction.mainText} · ${prediction.secondaryText}`
        : prediction.mainText,
    );
    setPredictions([]);
    setOpen(false);
    setCard(null);
    setActionError(null);
    applyLookup(prediction);
  };

  const goHeld = (placeId: string) => {
    router.push(placeHref(placeId));
    router.refresh();
  };

  const onCreate = () => {
    if (!selected) return;
    setActionError(null);
    startAction(async () => {
      const result = await createThenClaimAction(
        selected.placeId,
        organizationId,
      );
      if (result.heldPlaceId) {
        goHeld(result.heldPlaceId);
        return;
      }
      if (result.alreadyExists) {
        setActionError(null);
        applyLookup(selected);
        return;
      }
      if (result.retryPlaceId) {
        setActionError(result.error);
        applyLookup(selected);
        return;
      }
      setActionError(result.error);
    });
  };

  const onAdd = (placeId: string) => {
    setActionError(null);
    startAction(async () => {
      const result = await addListedPlaceAction(placeId, organizationId);
      if (result.heldPlaceId) {
        goHeld(result.heldPlaceId);
        return;
      }
      setActionError(result.error);
    });
  };

  const expanded = open && !selected && predictions.length > 0;
  const activeId =
    expanded && predictions[highlight]
      ? `${listId}-${predictions[highlight].placeId}`
      : undefined;

  return (
    <div className={FORM_COLUMN_CLASS}>
      <div className="block">
        <span className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
          Place
        </span>
        <div className="relative">
          <input
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-activedescendant={activeId}
            autoComplete="off"
            autoFocus
            value={query}
            placeholder="Search by place name"
            className={INPUT_CLASS}
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              if (selected) {
                setSelected(null);
                setCard(null);
                setLookupError(null);
                setActionError(null);
                sessionTokenRef.current = newSessionToken();
              }
              if (next.trim().length < 2) {
                setPredictions([]);
                setOpen(false);
              }
            }}
            onKeyDown={(e) => {
              if (!expanded) {
                if (e.key === "Escape" && selected) {
                  setSelected(null);
                  setCard(null);
                  setQuery("");
                  sessionTokenRef.current = newSessionToken();
                }
                return;
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((i) => (i + 1) % predictions.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight(
                  (i) => (i - 1 + predictions.length) % predictions.length,
                );
              } else if (e.key === "Enter") {
                e.preventDefault();
                const hit = predictions[highlight];
                if (hit) pick(hit);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              }
            }}
          />
          {(searching || lookupPending || actionPending) && (
            <Loader2 className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
          )}
          {expanded && (
            <ul
              id={listId}
              role="listbox"
              className="border-border bg-card absolute inset-x-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border p-1"
            >
              {predictions.map((p, i) => (
                <li key={p.placeId} role="presentation">
                  <button
                    type="button"
                    id={`${listId}-${p.placeId}`}
                    role="option"
                    aria-selected={i === highlight}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => pick(p)}
                    className={cn(
                      "flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm",
                      i === highlight ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  >
                    <span className="truncate font-semibold">{p.mainText}</span>
                    {p.secondaryText ? (
                      <span className="text-muted-foreground truncate text-[12px]">
                        {p.secondaryText}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {searchError ? <p className={ERROR_BOX_CLASS}>{searchError}</p> : null}

      {!selected &&
        !searching &&
        !searchError &&
        query.trim().length >= 2 &&
        predictions.length === 0 && (
          <p className="text-muted-foreground text-xs">
            No matches. Try a different spelling.
          </p>
        )}

      <div aria-live="polite" className="flex flex-col gap-3">
        {selected && lookupPending && !card ? (
          <p className="text-muted-foreground text-sm">Looking up…</p>
        ) : null}
        {lookupError ? (
          <p className={ERROR_BOX_CLASS}>
            {lookupError}{" "}
            {selected ? (
              <button
                type="button"
                className="underline"
                onClick={() => applyLookup(selected)}
              >
                Try again
              </button>
            ) : null}
          </p>
        ) : null}
        {card?.kind === "create" && (
          <CreatePlaceCard
            prediction={card.prediction}
            canAdd={canAdd}
            pending={actionPending}
            error={actionError}
            onCreate={onCreate}
          />
        )}
        {card?.kind === "add" && (
          <AddListedPlaceCard
            place={card.place}
            canAdd={canAdd}
            pending={actionPending}
            error={actionError}
            onAdd={() => onAdd(card.place.id)}
          />
        )}
        {card?.kind === "open" && (
          <OpenHeldPlaceCard placeId={card.placeId} name={card.name} />
        )}
        {card?.kind === "partner" && (
          <PartnerOtherCard
            place={card.place}
            ownerEmail={card.ownerEmail}
          />
        )}
      </div>

      <Link href={cancelHref} className={`${GHOST_PILL_BUTTON_CLASS} self-start`}>
        Cancel
      </Link>
    </div>
  );
}
