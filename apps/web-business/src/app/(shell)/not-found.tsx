import { PageErrorState } from "@/components/business/PageErrorState";
import { SHELL_ROUTES } from "@/lib/console-routes";

export default function ShellNotFound() {
  return (
    <PageErrorState
      heading="Not found"
      message="That organization, place or page doesn't exist for you. Switch organizations from the Organization box in the menu if you were looking at the other one."
      retryHref={SHELL_ROUTES.root}
    />
  );
}
