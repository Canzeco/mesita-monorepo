"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import {
  FILTERABLE_PLACE_FAMILIES,
  type FamilyKey,
} from "@/lib/place-families";
import { cn } from "@/lib/utils";

import { CHIP_OFF_FLAT, CHIP_ON } from "./header-classes";

// THE FILTERS SHEET (Pato, MESITA-2903: "when i click filters, open the modal
// to see select multiple families"). The Filters disc opens it. Every family
// is a toggle; the guest picks any number into a DRAFT, and Show places
// applies it — one Area reload, not one per tap. Clear empties the draft
// (Top). The server ORs the families (`familyKeys`, area-score.ts
// familyGate), so two picks show places of either. The chip row stays the
// one-tap pick of a single family.
//
// SHARED BY SEARCH AND HOME (MESITA-3666, Pato: "add the filters button
// before top, like in categories"): the caller owns the applied set; Search
// passes the map's filters, Home its catalog's families.
//
// A CENTRED FLOATING DIALOG, NOT A SHEET (MESITA-4038, Pato: "use more a
// modal floating on the screen like that, like that modal popping from bottom
// to top looks kinda like shit"; "that" is the place screen's offer info
// card). Title, the chip wrap (it scrolls inside the card when taller than the
// screen), then one row of buttons: Clear grey, Show places black. The chip
// words are the 13px body role ("keep family words smaller"), the map chips
// stay 14px.

/** A filter chip: the map chip's shape, 28px tall, 13px words. */
const FILTER_CHIP =
  "flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 type-body font-semibold whitespace-nowrap transition outline-none focus-visible:border-foreground active:scale-[0.97]";
const DIALOG_BUTTON =
  "h-11 rounded-xl text-sm font-semibold transition hover:opacity-90";

export function FamilyFilterSheet({
  open,
  onClose,
  applied,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  /** The families applied now; the draft starts from them. */
  applied: readonly FamilyKey[];
  onApply: (families: FamilyKey[]) => void;
}) {
  return (
    <LocalDialog open={open} onClose={onClose} ariaLabel="Filters" fit>
      {/* Mounted per opening, so the draft starts from the applied set. */}
      {open ? (
        <FamilyFilterBody
          onClose={onClose}
          applied={applied}
          onApply={onApply}
        />
      ) : null}
    </LocalDialog>
  );
}

function FamilyFilterBody({
  onClose,
  applied,
  onApply,
}: {
  onClose: () => void;
  applied: readonly FamilyKey[];
  onApply: (families: FamilyKey[]) => void;
}) {
  const [draft, setDraft] = useState<FamilyKey[]>([...applied]);
  const picked = new Set(draft);

  const toggle = (key: FamilyKey) =>
    setDraft((d) =>
      d.includes(key) ? d.filter((k) => k !== key) : [...d, key],
    );

  const apply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <div className="flex min-h-0 flex-col gap-4 p-5" data-search-filter-sheet>
      <h2 className="text-foreground text-base font-semibold">Filters</h2>
      {/* No explanation line under the title (MESITA-3897, Pato: "delete
          the stupid obvious explanation here"). */}
      <div
        role="group"
        aria-label="Families"
        className="scrollbar-hide -m-1 flex min-h-0 flex-wrap gap-2 overflow-y-auto p-1"
        data-search-filter-families
      >
        {FILTERABLE_PLACE_FAMILIES.map((family) => {
          const on = picked.has(family.key);
          return (
            <button
              key={family.key}
              type="button"
              onClick={() => toggle(family.key)}
              aria-pressed={on}
              className={cn(FILTER_CHIP, on ? CHIP_ON : CHIP_OFF_FLAT)}
            >
              {on ? (
                <Check
                  className="h-3.5 w-3.5 shrink-0"
                  strokeWidth={2.5}
                  aria-hidden
                />
              ) : (
                // The family's emoji, as on the chips and Home (MESITA-3760).
                <span
                  aria-hidden
                  className="type-body w-3.5 shrink-0 text-center leading-none"
                >
                  {family.emoji}
                </span>
              )}
              <span>{family.label}</span>
            </button>
          );
        })}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setDraft([])}
          disabled={draft.length === 0}
          className={cn(
            DIALOG_BUTTON,
            "bg-muted text-foreground w-28 shrink-0 disabled:opacity-40",
          )}
          data-search-filter-clear
        >
          Clear
        </button>
        <button
          type="button"
          onClick={apply}
          className={cn(DIALOG_BUTTON, "bg-foreground text-paper flex-1")}
          data-search-filter-apply
        >
          {draft.length === 0
            ? "Show all places"
            : `Show places · ${draft.length} ${draft.length === 1 ? "family" : "families"}`}
        </button>
      </div>
    </div>
  );
}
