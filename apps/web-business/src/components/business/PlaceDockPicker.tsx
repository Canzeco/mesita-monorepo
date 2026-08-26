"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { Check, LayoutGrid, Plus } from "lucide-react";
import { cn, initialLetter } from "@/lib/utils";
import { placeSubtitle } from "@/components/business/place/place-utils";
import {
  BUSINESS_ROUTES,
  placeSwitchHref,
} from "@/lib/business-route-contract";
import type { MyPlace } from "@/lib/api/places";

type MenuRect = {
  bottom: number;
  left: number;
  width: number;
};

export function PlaceDockPicker({
  open,
  places,
  activePlace,
  pathname,
  menuRect,
  onClose,
}: {
  open: boolean;
  places: MyPlace[];
  activePlace: MyPlace | null;
  pathname: string;
  menuRect: MenuRect;
  onClose: () => void;
}) {
  if (!open || !activePlace) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close place picker"
        onClick={onClose}
        className="fixed inset-0 z-[100] cursor-default bg-black/30"
      />
      <div
        className="border-border bg-card shadow-elev fixed z-[110] max-h-[min(20rem,50vh)] overflow-y-auto rounded-2xl border"
        style={{
          bottom: menuRect.bottom,
          left: menuRect.left + 12,
          width: Math.max(menuRect.width - 24, 0),
        }}
      >
        <p className="text-muted-foreground border-border/40 bg-card sticky top-0 border-b px-3 pt-2.5 pb-2 text-[10px] font-semibold tracking-[0.12em] uppercase">
          Your places
        </p>
        {places.map((v) => (
          <Link
            key={v.id}
            href={placeSwitchHref(v.id, pathname)}
            onClick={onClose}
            className={cn(
              "hover:bg-muted/40 flex items-center gap-3 px-3 py-2.5 transition",
              v.id === activePlace.id && "bg-primary/5",
            )}
          >
            <PlaceAvatar name={v.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{v.name}</p>
              <p className="text-muted-foreground truncate text-[11px]">
                {placeSubtitle(v, "Tap to switch")}
              </p>
            </div>
            {v.id === activePlace.id ? (
              <Check className="text-primary h-4 w-4 shrink-0" />
            ) : null}
          </Link>
        ))}
        <Link
          href={BUSINESS_ROUTES.central}
          onClick={onClose}
          className="border-border hover:bg-muted/40 flex items-center gap-2 border-t px-3 py-2.5 text-sm font-semibold transition"
        >
          <LayoutGrid className="h-4 w-4" />
          All places
        </Link>
        <Link
          href="/add"
          onClick={onClose}
          className="text-primary hover:bg-primary/5 flex items-center gap-2 px-3 py-2.5 text-sm font-semibold transition"
        >
          <Plus className="h-4 w-4" />
          Add a place
        </Link>
      </div>
    </>,
    document.body,
  );
}

export function PlaceChip({ name }: { name: string }) {
  const initial = initialLetter(name);
  return (
    <span className="bg-pink-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white shadow-sm">
      {initial}
    </span>
  );
}

function PlaceAvatar({ name }: { name: string }) {
  const initial = initialLetter(name);
  return (
    <span className="bg-pink-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
      {initial}
    </span>
  );
}
