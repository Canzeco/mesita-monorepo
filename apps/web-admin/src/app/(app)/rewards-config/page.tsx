import { redirect } from "next/navigation";

// Promos Config parent route → Tiers, where every rate is priced.
export default function PromosConfigIndex() {
  redirect("/rewards-config/tiers");
}
