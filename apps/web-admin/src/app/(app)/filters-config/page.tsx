import { redirect } from "next/navigation";

// Discovery has two pages; Signals is the one that defines what the other
// inherits, so it is the landing.
export default function DiscoveryIndex() {
  redirect("/filters-config/signals");
}
