import { redirect } from "next/navigation";

// Promos Config parent route → Visits, the only context that prices anything
// today. Subpages: visits, orders, distribution.
export default function PromosConfigIndex() {
  redirect("/rewards-config/visits");
}
