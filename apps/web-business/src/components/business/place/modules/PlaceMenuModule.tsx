"use client";

import { PlaceBox } from "../PlaceBox";
import { PlaceKvField } from "../PlaceKvField";
import { PlaceMenuFields } from "../PlaceMenuFields";
import { PlaceModule } from "../PlaceModule";
import type { PlaceFormState, SetPlaceForm } from "../place-form-types";

export function PlaceMenuModule({
  projectId,
  form,
  set,
  onError,
  hideHeader = false,
}: {
  projectId: string;
  form: PlaceFormState;
  set: SetPlaceForm;
  onError: (msg: string | null) => void;
  hideHeader?: boolean;
}) {
  if (hideHeader) {
    return (
      <PlaceBox>
        <PlaceKvField label="Menu">
          <PlaceMenuFields
            projectId={projectId}
            form={form}
            set={set}
            onError={onError}
          />
        </PlaceKvField>
      </PlaceBox>
    );
  }

  return (
    <PlaceModule id="products" hideHeader={hideHeader}>
      <PlaceMenuFields
        projectId={projectId}
        form={form}
        set={set}
        onError={onError}
      />
    </PlaceModule>
  );
}
