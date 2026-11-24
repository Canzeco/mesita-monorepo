"use client";

import { CategoriesModal } from "@/components/consumer/home/CategoriesModal";
import {
  FILTERABLE_PLACE_FAMILIES,
  type FamilyKey,
} from "@/lib/place-families";
import type { MapSpecial } from "@/lib/map-filters-engine";
import { FamilyMark } from "@/lib/family-icons";
import { cn } from "@/lib/utils";

// SEARCH'S MENU (Pato, MESITA-4469: "modal in search must be similar as
// modal in home" and "not multiselector"). Home's Categories modal: the
// same floating card, the same circles, one pick. A tap chooses that one
// family, or Popular, and closes. There is no draft and no Show places.
// The circles are Home's (CatalogRails): 44px, the name under the icon,
// the chosen circle ink.

const TILE =
  "flex w-auto shrink-0 flex-col items-center gap-0.5 pb-1 type-meta transition active:scale-[0.96]";
const CIRCLE =
  "flex h-11 w-11 items-center justify-center rounded-full text-lg leading-none transition";
const CIRCLE_OFF = "bg-card border-border border";
const CIRCLE_ON = "bg-foreground border border-transparent";
const NAME = "relative w-full truncate text-center";

function Circle({
  mark,
  label,
  on,
  onPick,
}: {
  /** The row or family key whose picture it wears (MESITA-4782). */
  mark: string;
  label: string;
  on: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={on}
      className={TILE}
    >
      <span aria-hidden className={cn(CIRCLE, on ? CIRCLE_ON : CIRCLE_OFF)}>
        <FamilyMark name={mark} on={on} />
      </span>
      <span
        className={cn(
          NAME,
          on ? "text-foreground font-semibold" : "text-muted-foreground font-semibold",
        )}
      >
        {label}
      </span>
    </button>
  );
}

export function FamilyFilterSheet({
  open,
  onClose,
  applied,
  onApply,
  special,
  onSpecial,
}: {
  open: boolean;
  onClose: () => void;
  /** The family applied now, if one is. Several is an old session; a tap
   *  replaces it with one. */
  applied: readonly FamilyKey[];
  onApply: (families: FamilyKey[]) => void;
  /** Nearby, lit (MESITA-4592). */
  special: MapSpecial | null;
  onSpecial: (special: MapSpecial) => void;
}) {
  const selected = special === null && applied.length === 1 ? applied[0] : null;
  const pick = (families: FamilyKey[]) => {
    onApply(families);
    onClose();
  };

  return (
    <CategoriesModal
      open={open}
      onClose={onClose}
      // SAVED · NEARBY · POPULAR, AS ON HOME (Pato, 2026-11-21, MESITA-4592:
      // "WHERE THE FUCK IS NEARBY AND SAVED????").
      specials={
        <>
          {/* No Saved on Search since MESITA-4786. */}
          <Circle
            mark="nearby"
            label="Nearby"
            on={special === "nearby"}
            onPick={() => {
              onSpecial("nearby");
              onClose();
            }}
          />
          <Circle
            mark="all"
            label="Popular"
            on={special === null && applied.length === 0}
            onPick={() => pick([])}
          />
        </>
      }
    >
      {FILTERABLE_PLACE_FAMILIES.map((family) => (
        <Circle
          key={family.key}
          mark={family.key}
          label={family.label}
          on={selected === family.key}
          onPick={() => pick([family.key])}
        />
      ))}
    </CategoriesModal>
  );
}
