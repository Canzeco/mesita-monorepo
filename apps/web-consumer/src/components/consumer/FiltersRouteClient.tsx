"use client";

import { useRouter } from "next/navigation";
import { DiscoveryFilters } from "@/components/consumer/DiscoveryFilters";
import { useFiltersHostContext } from "@/lib/filters-host-context";

// Body of the routed /filters modal (soft @modal + hard page). Host context
// is published by Swipe/Catalog/Search; dismiss is always router.back().

export function FiltersRouteClient() {
  const router = useRouter();
  const host = useFiltersHostContext();

  return (
    <DiscoveryFilters
      onClose={() => router.back()}
      categoryOptions={host.categoryOptions}
      count={host.count}
      hasLocation={host.hasLocation}
    />
  );
}
