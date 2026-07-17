"use client";

import type { ReactNode } from "react";
import {
  Compass,
  Crosshair,
  Globe,
  MapPin as MapPinIcon,
  Sparkles,
} from "lucide-react";
import { SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { Skeleton, Spinner } from "@/components/shared";
import {
  MAP_PARTNER_PIN_COLOR,
  MAP_WEB_PIN_COLOR,
} from "@/lib/map-defaults";

export function MapLoadingVeil({ loadFailed }: { loadFailed: boolean }) {
  if (loadFailed) {
    return null;
  }
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <Skeleton className="absolute inset-0 rounded-none" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Spinner
          label="Loading map"
          className="border-border border-t-primary"
        />
      </div>
    </div>
  );
}

export function MapChromeHeader({
  placesCount,
  totalPlaces,
}: {
  placesCount: number;
  totalPlaces: number;
}) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
      <div className="bg-card/95 text-foreground pointer-events-auto rounded-full px-3 py-1.5 text-[11px] font-semibold backdrop-blur">
        <Compass className="mr-1 inline-block h-3 w-3 -translate-y-0.5" />
        {placesCount} of {totalPlaces} near here
      </div>
      <div className="bg-card/95 text-foreground pointer-events-auto flex flex-col gap-1 rounded-2xl p-2 text-[10px] font-semibold backdrop-blur">
        <LegendDot
          color={MAP_PARTNER_PIN_COLOR}
          icon={<Sparkles className="h-2.5 w-2.5" />}
        >
          Partner
        </LegendDot>
        <LegendDot
          color={MAP_WEB_PIN_COLOR}
          icon={<Globe className="h-2.5 w-2.5" />}
        >
          Web listing
        </LegendDot>
      </div>
    </header>
  );
}

export function RecentreButton({
  onRecentre,
  raised = false,
}: {
  onRecentre: () => void;
  raised?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onRecentre}
      aria-label="Centre map on me"
      className={`bg-card text-foreground shadow-elev hover:bg-muted absolute right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full transition ${
        raised ? "bottom-28" : "bottom-4"
      }`}
    >
      <Crosshair className="h-4 w-4" />
    </button>
  );
}

export function LegendDot({
  color,
  icon,
  children,
}: {
  color: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="flex h-3 w-3 items-center justify-center rounded-full text-white"
        style={{ background: color }}
      >
        {icon}
      </span>
      {children}
    </span>
  );
}

export function SetupCard({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-2xl">
        <MapPinIcon className="text-muted-foreground h-5 w-5" />
      </div>
      <h2 className={SHEET_TITLE_CLASS}>{title}</h2>
      <p className="text-muted-foreground max-w-sm text-sm">{body}</p>
    </div>
  );
}
