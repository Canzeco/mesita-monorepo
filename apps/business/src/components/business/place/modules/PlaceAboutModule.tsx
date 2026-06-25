import { PlaceAboutField } from "../PlaceAboutField";
import { PlaceKvField } from "../PlaceKvField";
import { PlaceModule } from "../PlaceModule";

export function PlaceAboutModule({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <PlaceModule id="about">
      <PlaceKvField label="About">
        <PlaceAboutField value={value} onChange={onChange} />
      </PlaceKvField>
    </PlaceModule>
  );
}
