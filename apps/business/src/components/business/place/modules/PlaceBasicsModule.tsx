import type { MyPlace } from "@/lib/api/places";
import { PlaceBasicsSection } from "../PlaceBasicsSection";
import type { PlaceFormState, SetPlaceForm } from "../place-form-types";

export function PlaceBasicsModule({
  place,
  form,
  set,
}: {
  place: MyPlace;
  form: PlaceFormState;
  set: SetPlaceForm;
}) {
  return (
    <PlaceBasicsSection place={place} form={form} set={set} />
  );
}
