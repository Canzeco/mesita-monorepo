import { PageErrorState } from "@/components/business/PageErrorState";
import { PLACE_BASE } from "@/lib/place-base";

export default function AdminPlaceNotFound() {
  return (
    <PageErrorState
      heading="No place here"
      message="Mesita holds no place with that id, or the address names a view it doesn't have. Find it again from Single Place."
      retryHref={PLACE_BASE}
    />
  );
}
