"use client";

// Single Place › Find › From Google (MESITA-2094). A name runs one Google
// Text Search beside the catalog match, through the same route Multiple
// Places › Google Search uses — so Discovery › Map's floors apply here as
// everywhere, and the list says how many they removed. A row Mesita already
// holds opens the place; a row it does not gets Add, which mints it with the
// same action Create uses and stays in the list, so several can be added
// from one search.

import { ChevronRight, Globe, Loader2, Plus } from "lucide-react";
import { StateIcon, type BatchRowState } from "@/app/(app)/manage-multiple/StateIcon";
import type { PlaceLite, SearchErrorResponse, SearchResponse } from "@/lib/places-types";
import { GOOGLE_NAME_RESULTS } from "./single-place-lookup";

export type GoogleNameResult = {
  places: PlaceLite[];
  /** Discovery › Map floors the backend applied (0 = off) and what they hid. */
  minRating: number;
  minUserRatingCount: number;
  filteredOutCount: number;
  /** Non-null when the EF's Mesita join failed — its On Mesita flags are then
   *  all false, and only the catalog and this page's Adds still witness. */
  mesitaLookupError: string | null;
};

export type GoogleState =
  | { status: "loading" }
  | { status: "ok"; result: GoogleNameResult }
  | { status: "error"; error: string };

export type GoogleRowNote = { state: BatchRowState; text: string };

export async function searchGoogleByName(query: string): Promise<GoogleState> {
  try {
    const res = await fetch("/api/bulk-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queries: [query],
        placeIds: [],
        regionCode: "",
        maxResultsPerQuery: GOOGLE_NAME_RESULTS,
      }),
    });
    const data: SearchResponse | SearchErrorResponse = await res.json();
    if (!data.ok) {
      return { status: "error", error: data.error || `Google search failed (HTTP ${res.status})` };
    }
    const q = data.queries[0];
    if (q?.error) return { status: "error", error: q.error };
    return {
      status: "ok",
      result: {
        places: q?.places ?? data.uniquePlaces,
        minRating: data.minRating,
        minUserRatingCount: data.minUserRatingCount,
        filteredOutCount: data.filteredOutCount,
        mesitaLookupError: data.mesitaLookupError,
      },
    };
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

export function GoogleMatchList({
  query,
  google,
  onMesita,
  notes,
  disabled,
  onOpen,
  onAdd,
}: {
  query: string;
  google: GoogleState;
  onMesita: (place: PlaceLite) => boolean;
  notes: Readonly<Record<string, GoogleRowNote>>;
  disabled: boolean;
  onOpen: (place: PlaceLite) => void;
  onAdd: (place: PlaceLite) => void;
}) {
  if (google.status === "loading") {
    return (
      <p className="text-muted-foreground mt-2 inline-flex items-center gap-2 text-sm">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Searching Google for “{query}”…
      </p>
    );
  }
  if (google.status === "error") {
    return <p className="text-destructive mt-2 text-sm">Google search failed: {google.error}</p>;
  }
  const { places, filteredOutCount, minRating, minUserRatingCount, mesitaLookupError } =
    google.result;
  const floors = floorsLabel(minRating, minUserRatingCount);
  return (
    <div className="mt-2">
      {places.length === 0 ? (
        <p className="text-muted-foreground text-sm">Google found nothing for “{query}”.</p>
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-2xl border">
          <p className="text-muted-foreground border-border border-b px-4 py-2 type-label">
            {places.length} result{places.length === 1 ? "" : "s"} ·{" "}
            {places.filter(onMesita).length} on Mesita
          </p>
          <ul className="divide-border/60 divide-y">
            {places.map((p) => {
              const held = onMesita(p);
              const note = notes[p.id];
              const adding = note?.state === "running";
              return (
                <li key={p.id} className="flex items-center gap-3 pr-4">
                  <button
                    type="button"
                    onClick={() => onOpen(p)}
                    disabled={disabled || adding}
                    className="hover:bg-muted/50 flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left text-sm transition disabled:opacity-60"
                  >
                    <Globe className="text-muted-foreground h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.displayName}</span>
                      <span className="text-muted-foreground block truncate type-label">
                        {[p.formattedAddress, ratingLabel(p)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                  {note && note.state !== "running" ? (
                    <span
                      className={
                        "inline-flex max-w-56 shrink-0 items-center gap-1.5 type-label " +
                        (note.state === "error" ? "text-destructive" : "text-muted-foreground")
                      }
                    >
                      <StateIcon state={note.state} />
                      <span className="truncate">{note.text}</span>
                    </span>
                  ) : null}
                  {held ? (
                    <button
                      type="button"
                      onClick={() => onOpen(p)}
                      disabled={disabled}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 type-label font-semibold text-green-700 disabled:opacity-60"
                    >
                      On Mesita
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAdd(p)}
                      disabled={disabled || adding}
                      className="bg-foreground text-background inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold disabled:opacity-50"
                    >
                      {adding ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      {adding ? "Adding…" : "Add"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {filteredOutCount > 0 ? (
        <p className="text-muted-foreground mt-2 type-label">
          {filteredOutCount} more hidden by Discovery › Map{floors ? ` (${floors})` : ""}.
        </p>
      ) : null}
      {mesitaLookupError ? (
        <p className="text-muted-foreground mt-2 type-label">
          Mesita lookup failed ({mesitaLookupError}) — On Mesita reads the catalog only.
        </p>
      ) : null}
    </div>
  );
}

function ratingLabel(p: PlaceLite): string | null {
  if (p.rating == null) return null;
  return `${p.rating.toFixed(1)} · ${(p.userRatingCount ?? 0).toLocaleString()} reviews`;
}

function floorsLabel(minRating: number, minUserRatingCount: number): string {
  const parts: string[] = [];
  if (minRating > 0) parts.push(`rating ≥ ${minRating}`);
  if (minUserRatingCount > 0) parts.push(`reviews ≥ ${minUserRatingCount.toLocaleString()}`);
  return parts.join(", ");
}
