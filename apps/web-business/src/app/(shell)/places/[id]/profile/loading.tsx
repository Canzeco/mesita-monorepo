// Profile suspends on `getManagePlace`, and a pool place additionally renders
// a gallery band. Three cards is the manage shape; see PlaceViewSkeleton for
// why every view needs a boundary of its own.
import { PlaceViewSkeleton } from "@/components/console/PlaceViewSkeleton";

export default function ProfileLoading() {
  return (
    <PlaceViewSkeleton
      label="Loading profile…"
      blocks={["h-[132px]", "h-[132px]", "h-[132px]"]}
    />
  );
}
