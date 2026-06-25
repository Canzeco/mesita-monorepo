"use client";

import type { MyVenue } from "@/lib/api/venues";
import { PlaceAboutField } from "./PlaceAboutField";
import { PlaceBox } from "./PlaceBox";
import { PlaceCategorySelect } from "./PlaceCategorySelect";
import { PlaceHoursSection } from "./PlaceHoursSection";
import { PlaceLocationFields } from "./PlaceLocationFields";
import {
  PLACE_GOOGLE_FIELD_INFO,
  PlaceKvField,
} from "./PlaceKvField";
import { PlaceTagsField } from "./PlaceTagsField";
import type { PlaceFormState, SetPlaceForm } from "./place-form-types";
import {
  humanizeVenueToken,
  resolveVenueTierLabel,
  resolveVenueVerification,
} from "./place-utils";

const VERIFICATION_TONE_CLASS = {
  verified: "text-emerald-700",
  pending: "text-amber-700",
  unverified: "text-muted-foreground",
} as const;

export function PlaceBasicsSection({
  venue,
  form,
  set,
}: {
  venue: MyVenue;
  form: PlaceFormState;
  set: SetPlaceForm;
}) {
  const name = venue.name?.trim() || "—";
  const status = humanizeVenueToken(venue.status);
  const verification = resolveVenueVerification(venue);
  const tier = resolveVenueTierLabel(venue);

  return (
    <div className="flex flex-col gap-4">
      <PlaceBox>
        <PlaceKvField
          label="Name"
          value={name}
          infoMessage={PLACE_GOOGLE_FIELD_INFO}
          blocked
        />
        <PlaceKvField label="Category">
          <PlaceCategorySelect
            bare
            value={form.category}
            onChange={(category) => set("category", category)}
            googleCategoryLabel={venue.category_label}
            googleCategorySlug={venue.category}
          />
        </PlaceKvField>
        <PlaceKvField label="Status" value={status} blocked />
        <PlaceKvField
          label="Verification"
          hint="Ownership"
          value={verification.label}
          blocked
          valueClassName={VERIFICATION_TONE_CLASS[verification.tone]}
        />
        <PlaceKvField
          label="Tier"
          hint="Partnership & plan"
          value={tier}
          blocked
        />
      </PlaceBox>

      <PlaceBox>
        <PlaceLocationFields venue={venue} />
      </PlaceBox>

      <PlaceBox>
        <PlaceKvField label="Hours">
          <PlaceHoursSection
            hours={form.hours}
            onChange={(hours) => set("hours", hours)}
            timezone={venue.timezone}
          />
        </PlaceKvField>
      </PlaceBox>

      <PlaceBox>
        <PlaceKvField label="About">
          <PlaceAboutField
            value={form.description}
            onChange={(description) => set("description", description)}
          />
        </PlaceKvField>
        <PlaceKvField label="Tags">
          <PlaceTagsField
            value={form.tags}
            onChange={(tags) => set("tags", tags)}
          />
        </PlaceKvField>
      </PlaceBox>
    </div>
  );
}
