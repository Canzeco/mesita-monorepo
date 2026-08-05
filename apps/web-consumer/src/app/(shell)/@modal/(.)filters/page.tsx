import { FiltersRouteClient } from "@/components/consumer/FiltersRouteClient";

export const dynamic = "force-dynamic";

// Intercepted /filters. Soft nav from Home Swipe or Search — underlying
// surface stays mounted; this renders inside the @modal slot.

export default function FiltersModalPage() {
  return <FiltersRouteClient />;
}
