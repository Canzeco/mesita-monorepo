import { redirect } from "next/navigation";

// Promos Config parent route → default to the Config tab. Subpages: config,
// playground.
export default function PromosConfigIndex() {
  redirect("/rewards-config/config");
}
