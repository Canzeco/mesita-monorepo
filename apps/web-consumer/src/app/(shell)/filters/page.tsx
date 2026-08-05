import { FiltersRouteClient } from "@/components/consumer/FiltersRouteClient";

export const dynamic = "force-dynamic";

// Hard-nav landing for /filters (refresh, direct URL, shared link). Soft
// nav from inside (shell) hits the intercepted @modal/(.)filters variant.

export default function FiltersHardPage() {
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <FiltersRouteClient />
    </div>
  );
}
