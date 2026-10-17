"use client";

import { ChevronRight, Info, Utensils } from "lucide-react";

import type { PlaceActions } from "../../actions";
import { inertButtonProps } from "../../actions";
import { menuSubtitle } from "../../lib/menu-url";
import { nutritionLine } from "../../lib/nutrition";
import type { PlaceDetail } from "../../place-detail";

import { Box } from "./box";

// ── Menus ───────────────────────────────────────────────────────────────

// The Menu tab renders SoonScreen. This box stays for the stored files
// and is not mounted while that tab is Soon (Pato, 2026-10-16).
export function MenusBox({
  place,
  onOpenMenu,
}: {
  place: PlaceDetail;
  onOpenMenu?: PlaceActions["onOpenMenu"];
}) {
  // Sole occupant of the Menu tab, so it never returns null — a place with
  // no menus renders an explicit empty state instead of a blank tab.
  //
  // `place.products.menu` keeps its name: that is the column the row is read
  // from (places.products.menu). Storage vocabulary does not follow a label.
  // The file viewer stays in the consumer; this box only calls onOpenMenu.
  const menus = place.products.menu;

  if (menus.length === 0) {
    return (
      <Box title="Menu" icon={Utensils} iconColor="text-muted-foreground">
        <div className="flex flex-col items-center gap-3 py-3 text-center">
          <span className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
            <Utensils className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-foreground text-sm font-semibold">
              No menu available yet
            </p>
            <p className="text-muted-foreground text-xs leading-snug">
              This place hasn&apos;t uploaded a menu yet.
            </p>
          </div>
        </div>
      </Box>
    );
  }
  return (
    <>
      <Box title="Menu" icon={Utensils} iconColor="text-muted-foreground">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
          <Info
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
            strokeWidth={2.25}
          />
          <p className="type-body leading-snug font-medium text-foreground">
            Reference only — current product prices may differ at the place.
          </p>
        </div>
        {menus.map((m) => (
          <ProductRow
            key={`${m.name}-${m.url}`}
            product={m}
            onView={onOpenMenu ? () => onOpenMenu(m) : undefined}
          />
        ))}
      </Box>
    </>
  );
}

function ProductRow({
  product,
  onView,
}: {
  product: PlaceDetail["products"]["menu"][number];
  onView?: () => void;
}) {
  const facts = nutritionLine(product.nutrition);
  return (
    <div className="bg-background flex items-center gap-3 rounded-xl p-3">
      <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-full">
        <Utensils className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display truncate text-base font-semibold">
          {product.name}
        </p>
        {facts ? (
          <p className="truncate text-xs tabular-nums">{facts}</p>
        ) : null}
        <p className="text-muted-foreground truncate text-xs">
          {menuSubtitle({
            kind: product.kind,
            pages: product.pages,
            updated_label: product.updated_label,
          })}
        </p>
      </div>
      <button
        type="button"
        {...(onView ? { onClick: onView } : inertButtonProps(false))}
        className="bg-foreground text-paper inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-90 active:scale-[0.97]"
      >
        View
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
