"use client";

// Foursquare (MESITA-4552): what Foursquare says about the matched place,
// read-only, staff only. The details come from one Places API read at match
// or deep update time (`place_profiles.foursquare_details`). Mesita's own
// text stays Mesita's: nothing here is shown to guests.

import { MapPinIcon } from "@phosphor-icons/react/dist/ssr";
import type { AdminPlace } from "../actions";
import { ReadField, SectionCard } from "@/components/ui/manage";
import { formatAbsoluteUtc } from "@/lib/format";

type Details = {
  name?: string;
  description?: string;
  categories?: Array<{ name?: string }>;
  rating?: number;
  price?: number;
  popularity?: number;
  website?: string;
  tel?: string;
  hours?: { display?: string; open_now?: boolean };
  stats?: { total_ratings?: number; total_tips?: number; total_photos?: number };
  tastes?: string[];
  location?: { formatted_address?: string };
  date_closed?: string;
};

const asDetails = (v: unknown): Details | null => (v && typeof v === "object" ? v as Details : null);

export function FoursquareCard({ place }: { place: AdminPlace }) {
  const p = place as Record<string, unknown>;
  const url = typeof p.foursquare_url === "string" ? p.foursquare_url : null;
  const d = asDetails(p.foursquare_details);
  const at = typeof p.foursquare_details_at === "string" ? p.foursquare_details_at : null;
  const rows: Array<[string, string]> = [];
  if (d) {
    if (d.name) rows.push(["Name", d.name]);
    if (d.categories?.length) rows.push(["Categories", d.categories.map((c) => c.name).filter(Boolean).join(" · ")]);
    if (typeof d.rating === "number") {
      rows.push(["Rating", `${d.rating} / 10${d.stats?.total_ratings ? ` · ${d.stats.total_ratings} ratings` : ""}`]);
    }
    if (typeof d.price === "number") rows.push(["Price", "$".repeat(Math.max(1, Math.min(4, d.price)))]);
    if (typeof d.popularity === "number") rows.push(["Popularity", d.popularity.toFixed(3)]);
    if (d.stats?.total_tips || d.stats?.total_photos) {
      rows.push(["Tips · Photos", `${d.stats?.total_tips ?? 0} · ${d.stats?.total_photos ?? 0}`]);
    }
    if (d.hours?.display) rows.push(["Hours", d.hours.display]);
    if (d.tastes?.length) rows.push(["Tastes", d.tastes.slice(0, 12).join(" · ")]);
    if (d.location?.formatted_address) rows.push(["Address", d.location.formatted_address]);
    if (d.tel) rows.push(["Phone", d.tel]);
    if (d.website) rows.push(["Website", d.website]);
    if (d.date_closed) rows.push(["Closed", d.date_closed]);
  }
  return (
    <SectionCard
      icon={<MapPinIcon size={20} />}
      title="Foursquare"
      subtitle={url ? (at ? `Read ${formatAbsoluteUtc(at)}.` : "Linked; details not read yet.") : "Not linked to Foursquare yet."}
    >
      <div className="mt-5 flex flex-col gap-4">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="type-body w-fit underline underline-offset-4">
            Open on Foursquare
          </a>
        ) : null}
        {d?.description ? <ReadField label="Description">{d.description}</ReadField> : null}
        {rows.map(([label, value]) => (
          <ReadField key={label} label={label}>
            {value}
          </ReadField>
        ))}
        {url && !d ? (
          <p className="text-muted-foreground type-meta">A Deep Update reads the details.</p>
        ) : null}
      </div>
    </SectionCard>
  );
}
