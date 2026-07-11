import { PlaceModule } from "../PlaceModule";
import { PlaceProfileProgressPanel } from "../PlaceProfileCompletionBar";
import type { PlaceFormState } from "../place-form-types";

export function PlaceProfileProgressModule({ v }: { v: PlaceFormState }) {
  return (
    <PlaceModule
      id="progress"
      title="Profile progress"
      description="Complete these items to improve your listing."
    >
      <PlaceProfileProgressPanel v={v} />
    </PlaceModule>
  );
}
