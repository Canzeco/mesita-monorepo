"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  FILTERABLE_PLACE_FAMILIES,
  type FamilyKey,
} from "@/lib/place-families";
import {
  PRIMARY_BUTTON_CLASS,
  SHEET_BODY_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

import { CHIP, CHIP_OFF_FLAT, CHIP_ON } from "./header-classes";

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
    <LocalSheet open={open} onClose={onClose} ariaLabel="Filters">
      {/* Mounted per opening, so the draft starts from the applied set. */}
      {open ? (
        <FamilyFilterBody
          onClose={onClose}
          applied={applied}
          onApply={onApply}
        />
      ) : null}
    </LocalSheet>
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
    <>
      <div className={SHEET_BODY_CLASS} data-search-filter-sheet>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={SHEET_TITLE_CLASS}>Filters</h2>
          <button
            type="button"
            onClick={() => setDraft([])}
            disabled={draft.length === 0}
            className="text-muted-foreground hover:text-foreground text-sm font-semibold transition disabled:opacity-40"
            data-search-filter-clear
          >
            Clear
          </button>
        </div>
        {/* No explanation line under the title (MESITA-3897, Pato: "delete
            the stupid obvious explanation here"). */}
        <div
          role="group"
          aria-label="Families"
          className="mt-4 flex flex-wrap gap-2"
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
                className={cn(CHIP, on ? CHIP_ON : CHIP_OFF_FLAT)}
              >
                {on ? (
                  <Check
                    className="h-4 w-4 shrink-0"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                ) : (
                  // The family's emoji, as on the chips and Home (MESITA-3760).
                  <span
                    aria-hidden
                    className="w-4 shrink-0 text-center text-sm leading-none"
                  >
                    {family.emoji}
                  </span>
                )}
                <span>{family.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-border shrink-0 border-t p-4">
        <button
          type="button"
          onClick={apply}
          className={PRIMARY_BUTTON_CLASS}
          data-search-filter-apply
        >
          {draft.length === 0
            ? "Show all places"
            : `Show places · ${draft.length} ${draft.length === 1 ? "family" : "families"}`}
        </button>
      </div>
    </>
  );
}
