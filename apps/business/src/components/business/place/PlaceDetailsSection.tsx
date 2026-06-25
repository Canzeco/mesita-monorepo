import type { MyVenue } from "@/lib/api/venues";
import { PlaceKvField } from "./PlaceKvField";
import {
  humanizeVenueToken,
  resolveVenuePriceLabel,
  resolveVenueVerification,
} from "./place-utils";

const VERIFICATION_TONE_CLASS = {
  verified: "text-emerald-700",
  pending: "text-amber-700",
  unverified: "text-muted-foreground",
} as const;

export function PlaceDetailsSection({ venue }: { venue: MyVenue }) {
  const status = humanizeVenueToken(venue.status);
  const verification = resolveVenueVerification(venue);
  const price = resolveVenuePriceLabel(venue);

  return (
    <div className="flex flex-col gap-3">
      <PlaceKvField label="Status" value={status} hint="From Google" blocked />
      <PlaceKvField
        label="Verification"
        value={verification.label}
        hint="From Google"
        blocked
        valueClassName={VERIFICATION_TONE_CLASS[verification.tone]}
      />
      <PlaceKvField label="Price" value={price} hint="From Google" blocked />
    </div>
  );
}
