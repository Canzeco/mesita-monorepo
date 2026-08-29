"use client";

import type { MyPlace } from "@/lib/api/places";
import { PlaceAboutField } from "./PlaceAboutField";
import { PlaceBox } from "./PlaceBox";
import { PlaceCategorySelect } from "./PlaceCategorySelect";
import { PlaceSuperCategoryField } from "./PlaceSuperCategoryField";
import { PlaceHoursSection } from "./PlaceHoursSection";
import { PlaceLocationFields } from "./PlaceLocationFields";
import { PLACE_GOOGLE_FIELD_INFO, PlaceKvField } from "./PlaceKvField";
import { PlaceTagsPicker } from "./PlaceTagsPicker";
import type { PlaceFormState, SetPlaceForm } from "./place-form-types";
import {
  humanizePlaceToken,
  resolvePlaceTierLabel,
  resolvePlaceVerification,
} from "./place-utils";

const VERIFICATION_TONE_CLASS = {
  verified: "text-emerald-700",
  pending: "text-amber-700",
  unverified: "text-muted-foreground",
} as const;

export function PlaceBasicsSection({
  place,
  form,
  set,
}: {
  place: MyPlace;
  form: PlaceFormState;
  set: SetPlaceForm;
}) {
  const name = place.name?.trim() || "—";
  const status = humanizePlaceToken(place.status);
  const verification = resolvePlaceVerification(place);
  const tier = resolvePlaceTierLabel(place);

  return (
    <div className="flex flex-col gap-4">
      <PlaceBox>
        <PlaceKvField
          label="Name"
          value={name}
          infoMessage={PLACE_GOOGLE_FIELD_INFO}
          blocked
        />
        <PlaceSuperCategoryField
          category={form.category}
          familyKeys={place.family_keys ?? null}
        />
        <PlaceKvField label="Category">
          <PlaceCategorySelect
            value={form.category}
            onChange={(category) => set("category", category)}
            googleCategoryLabel={place.category_label}
            googleCategorySlug={place.category}
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
        <PlaceLocationFields place={place} />
      </PlaceBox>

      <PlaceBox>
        <PlaceKvField label="Hours">
          <PlaceHoursSection
            hours={form.hours}
            onChange={(hours) => set("hours", hours)}
            timezone={place.timezone}
          />
        </PlaceKvField>
      </PlaceBox>

      <PlaceBox>
        <PlaceKvField label="Presentation">
          <PlaceAboutField
            value={form.description}
            onChange={(description) => set("description", description)}
          />
        </PlaceKvField>
        <PlaceKvField label="Tags">
          <PlaceTagsPicker
            value={form.tags}
            onChange={(tags) => set("tags", tags)}
          />
        </PlaceKvField>
      </PlaceBox>
    </div>
  );
}
