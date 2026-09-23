import { ShoppingBag } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

// Order › Home (MESITA-2050). The orders vertical is DESIGNED, NOT BUILT
// (Notion Docs › Orders): no orders table, no order Edge Function, no
// consumer type, and `orders_config.enabled` is false. So this page is an
// honest empty state and nothing else.
//
// NO MOCK PLACES, deliberately. A deck of places to order from would promise
// a button that does not work — place detail's Order action is locked by
// default for the same reason — and Pato rejects mock data on product
// surfaces. When the vertical ships, the places that take orders render here
// and this empty state becomes the zero state for a city with none.
//
// NO ACTION BUTTON either, which EmptyState's own rule usually forbids. There
// is no next step a guest can take toward ordering today; a button to Visit
// would be a door to a different tab dressed as this one's answer.
export default function OrderHomePage() {
  return (
    <EmptyState
      icon={ShoppingBag}
      title="Ordering isn't live yet"
      description="Order ahead from places on Mesita, for pickup or delivery. It opens here first."
    />
  );
}
