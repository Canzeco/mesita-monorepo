import { GeneratingPlaceScreen } from "@/components/consumer/GeneratingPlace";

// Hard twin of the opening slide-over (MESITA-2311) while the route loads:
// the page's column, then the generating view OpeningGooglePlace draws
// while the profile is created (MESITA-2935).
export default function OpeningGooglePlaceLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <GeneratingPlaceScreen variant="page" />
    </div>
  );
}
