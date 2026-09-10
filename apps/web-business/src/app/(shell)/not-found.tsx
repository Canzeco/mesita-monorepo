import { PageErrorState } from "@/components/business/PageErrorState";

export default function ShellNotFound() {
  return (
    <PageErrorState
      heading="Not found"
      message="That place or page doesn't exist in this organization. Switch organizations from the switcher at the top of the menu if you were looking at the other one."
      retryHref="/"
    />
  );
}
