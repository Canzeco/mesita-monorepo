import { PageErrorState } from "@/components/business/PageErrorState";

export default function ShellNotFound() {
  return (
    <PageErrorState
      heading="Not found"
      message="That place or page doesn't exist in this organization. Switch orgs from the sidebar if you were looking at the other one."
      retryHref="/"
    />
  );
}
