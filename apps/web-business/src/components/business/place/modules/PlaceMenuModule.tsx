"use client";

import { PlaceBox } from "../PlaceBox";
import { PlaceKvField } from "../PlaceKvField";
import {
  PlaceMenuFields,
  type MenuSessionUploadsHandle,
} from "../PlaceMenuFields";
import type { PlaceFormState, SetPlaceForm } from "../place-form-types";

export function PlaceMenuModule({
  projectId,
  form,
  set,
  onError,
  sessionUploads,
}: {
  projectId: string;
  form: PlaceFormState;
  set: SetPlaceForm;
  onError: (msg: string | null) => void;
  sessionUploads?: MenuSessionUploadsHandle;
}) {
  return (
    <PlaceBox>
      <PlaceKvField label="Menu">
        <PlaceMenuFields
          projectId={projectId}
          form={form}
          set={set}
          onError={onError}
          sessionUploads={sessionUploads}
        />
      </PlaceKvField>
    </PlaceBox>
  );
}
