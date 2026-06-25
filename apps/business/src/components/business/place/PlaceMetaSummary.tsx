import type { MyVenue } from "@/lib/api/venues";
import { PlaceBlock } from "./PlaceBlock";
import { PlaceCategorySelect } from "./PlaceCategorySelect";
import { PlaceReadOnlyRow } from "./PlaceReadOnlyRow";
import { humanizeVenueToken, resolveVenuePriceLabel, resolveVenueVerification } from "./place-utils";

const VERIFICATION_TONE_CLASS = {
  verified: "text-emerald-700",
  pending: "text-amber-700",
  unverified: "text-muted-foreground",
} as const;

export function PlaceMetaSummary({
  venue,
  categorySlug,
  onCategoryChange,
}: {
  venue: MyVenue;
  categorySlug: string;
  onCategoryChange: (slug: string) => void;
}) {
  const name = venue.name?.trim() || "—";
  const status = humanizeVenueToken(venue.status);
  const verification = resolveVenueVerification(venue);
  const price = resolveVenuePriceLabel(venue);

  return (
    <PlaceBlock>
      <div className="divide-border/50 flex flex-col divide-y [&>div]:py-1.5">
        <PlaceReadOnlyRow label="Name" value={name} />
        <PlaceCategorySelect
          value={categorySlug}
          onChange={onCategoryChange}
          googleCategoryLabel={venue.category_label}
          googleCategorySlug={venue.category}
        />
        <PlaceReadOnlyRow label="Status" value={status} hint="From Google" />
        <PlaceReadOnlyRow
          label="Verification"
          value={verification.label}
          hint={verification.hint}
          valueClassName={VERIFICATION_TONE_CLASS[verification.tone]}
        />
        <PlaceReadOnlyRow label="Price" value={price} hint="From Google" />
      </div>
    </PlaceBlock>
  );
}
