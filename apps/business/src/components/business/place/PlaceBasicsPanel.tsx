import type { MyVenue } from "@/lib/api/venues";
import { PlaceAboutField } from "./PlaceAboutField";
import { PlaceBlock } from "./PlaceBlock";
import { PlaceMetaSummary } from "./PlaceMetaSummary";

export function PlaceBasicsPanel({
  venue,
  categorySlug,
  onCategoryChange,
  description,
  onDescriptionChange,
  location,
  hours,
}: {
  venue: MyVenue;
  categorySlug: string;
  onCategoryChange: (slug: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  location: React.ReactNode;
  hours: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <PlaceMetaSummary
        venue={venue}
        categorySlug={categorySlug}
        onCategoryChange={onCategoryChange}
      />
      <PlaceBlock title="Location">{location}</PlaceBlock>
      {hours}
      <PlaceAboutField value={description} onChange={onDescriptionChange} />
    </div>
  );
}
