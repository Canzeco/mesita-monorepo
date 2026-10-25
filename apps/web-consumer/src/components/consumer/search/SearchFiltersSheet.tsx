"use client";

// Search's Filters sheet (Pato, MESITA-2758: "Filters is just a button to open
// a button to select the family quicker. Only configuration now"). Opened by
// the Filters chip at the head of the chip row. Its ONE setting is the
// family: Top and every family laid out at once, wrapped, so a guest picks
// without scrolling the chip row. Same store as the chips — one pick at a
// time, the lit one again is Top — and a pick closes the sheet.

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";
import { FamilyIcon } from "@/lib/family-icons";
import {
  clearMapFamilies,
  selectMapFamily,
  useMapFilters,
} from "@/lib/use-map-filters";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { CHIP, CHIP_OFF, CHIP_ON } from "./header-classes";

const CHIP_ICON = "h-4 w-4 shrink-0";

export function SearchFiltersSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const filters = useMapFilters();
  const everyFamily = filters.familyKeys.length === 0;
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Filters">
      <div className={SHEET_BODY_CLASS} data-search-filters-sheet>
        <h2 className={SHEET_TITLE_CLASS}>Filters</h2>
        <p className="type-eyebrow text-muted-foreground mt-4">
          Family
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              clearMapFamilies();
              onClose();
            }}
            aria-pressed={everyFamily}
            className={cn(CHIP, everyFamily ? CHIP_ON : CHIP_OFF)}
          >
            <FamilyIcon
              name="all"
              className={CHIP_ICON}
              strokeWidth={everyFamily ? 2.25 : 1.75}
            />
            <span>Top</span>
          </button>
          {FILTERABLE_PLACE_FAMILIES.map((family) => {
            const on =
              filters.familyKeys.length === 1 &&
              filters.familyKeys[0] === family.key;
            return (
              <button
                key={family.key}
                type="button"
                onClick={() => {
                  selectMapFamily(family.key);
                  onClose();
                }}
                aria-pressed={on}
                className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
              >
                <FamilyIcon
                  name={family.key}
                  className={CHIP_ICON}
                  strokeWidth={on ? 2.25 : 1.75}
                />
                <span>{family.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </LocalSheet>
  );
}
