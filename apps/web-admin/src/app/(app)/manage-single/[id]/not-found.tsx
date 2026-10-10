import { PageErrorState } from "@/components/business/PageErrorState";
import { SHELL_ROUTES } from "@/lib/console-routes";

export default function AdminPlaceNotFound() {
  return (
    <PageErrorState
      heading="No place here"
      message="Mesita holds no place with that id, or the address names a view it doesn't have. Find it again from Single Place."
      retryHref={SHELL_ROUTES.places}
    />
  );
}
