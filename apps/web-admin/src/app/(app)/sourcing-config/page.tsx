import { redirect } from "next/navigation";

// Sourcing Config parent route → default to the Config tab. Subpages: config,
// playground.
export default function SourcingConfigIndex() {
  redirect("/sourcing-config/config");
}
