"use client";

import { Images } from "lucide-react";
import type { AdminPlace } from "../actions";
import { SectionCard } from "@/components/admin-ui/manage";
import { effectivePlacePhotos } from "@mesita/place-profile";

function urlList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
}

export function PhotoSourcesCard({ place }: { place: AdminPlace }) {
  const google = urlList(place.google_photos);
  const mesita = urlList(place.mesita_photos);
  const hero = mesita[0] ?? google[0] ?? effectivePlacePhotos(place)[0] ?? null;

  return (
    <SectionCard icon={<Images className="h-4 w-4" />} tint="violet" title="Photo sources">
      <p className="text-sm text-muted-foreground">
        Update refreshes Google only. Enrich builds the Mesita gallery; the first Mesita photo is the hero when present.
      </p>
      <dl className="mt-4 grid gap-3 text-sm">
        <div>
          <dt className="font-medium text-foreground">Hero (display)</dt>
          <dd className="text-muted-foreground break-all">{hero ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Google catalog ({google.length})</dt>
          <dd className="text-muted-foreground">{google.length ? "Refreshed by Update" : "Empty"}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Mesita catalog ({mesita.length})</dt>
          <dd className="text-muted-foreground">{mesita.length ? "From Enrich" : "Falls back to Google"}</dd>
        </div>
      </dl>
    </SectionCard>
  );
}
