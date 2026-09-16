import { PageErrorState } from "@/components/business/PageErrorState";
import { SHELL_ROUTES } from "@/lib/console-routes";

export default function ShellNotFound() {
  return (
    <PageErrorState
      heading="Not found"
      // A place you do not hold and a place that does not exist answer the
      // same way, deliberately (MESITA-1807): a different message for each
      // would let anyone with a URL bar probe which places exist. The door it
      // offers is the catalogue, which is where a place you CAN open is.
      message="That place or page doesn't exist for you. Every place you hold is in the menu, and the catalogue has the rest."
      retryHref={SHELL_ROUTES.places}
    />
  );
}
