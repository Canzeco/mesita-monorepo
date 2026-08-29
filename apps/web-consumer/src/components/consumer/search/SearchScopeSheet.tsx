"use client";

import { MapPin, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  SEARCH_COUNTRIES,
  countryChip,
  countryLabel,
} from "@/lib/search-scope";

/** Location (map + pin bias). Country stays Any — name search ignores it. */
export function SearchScopeSheet({
  country,
  locationSet,
  locating,
  onCountry,
  onUseLocation,
  onClearLocation,
  onClose,
}: {
  country: string | null;
  locationSet: boolean;
  locating: boolean;
  onCountry: (code: string | null) => void;
  onUseLocation: () => void;
  onClearLocation: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-foreground text-base font-semibold">Place search</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-full"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <section className="border-border space-y-3 border-t px-5 py-4">
        <div>
          <p className="text-foreground text-sm font-semibold">Location</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Centers the map and biases name search. Optional.
          </p>
        </div>
        <p className="text-foreground flex items-center gap-2 text-sm">
          <MapPin className="text-primary h-4 w-4 shrink-0" />
          {locationSet
            ? "Using your current location"
            : "Not set — the map stays on Monterrey and search is not biased"}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onUseLocation}
            disabled={locating}
            className="bg-pink-gradient rounded-full px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {locating ? "Locating…" : "Use my location"}
          </button>
          <button
            type="button"
            onClick={onClearLocation}
            disabled={!locationSet}
            className="border-border text-foreground rounded-full border px-3 py-2 text-xs font-semibold disabled:opacity-60"
          >
            Clear
          </button>
        </div>
      </section>

      <section className="border-border space-y-3 border-t px-5 py-4">
        <div>
          <p className="text-foreground text-sm font-semibold">Country</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Always Any. Autocomplete and Text Search do not take a country.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onCountry(null)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
              country == null
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {countryChip(null)}
          </button>
          {SEARCH_COUNTRIES.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => onCountry(item.code)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
                country === item.code
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {countryChip(item.code)}
              <span className="sr-only"> {countryLabel(item.code)}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
