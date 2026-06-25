import type { MyVenue } from "@/lib/api/venues";
import { PlaceBasicsSection } from "../PlaceBasicsSection";
import type { PlaceFormState, SetPlaceForm } from "../place-form-types";

export function PlaceBasicsModule({
  venue,
  form,
  set,
}: {
  venue: MyVenue;
  form: PlaceFormState;
  set: SetPlaceForm;
}) {
  return (
    <PlaceBasicsSection venue={venue} form={form} set={set} />
  );
}
