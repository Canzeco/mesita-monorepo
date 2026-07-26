import { redirect } from "next/navigation";

// The Enricher's run-cost estimator is the "Calculator" tab. Kept as a redirect
// so old "Playground" links/bookmarks keep working.
export default function LegacyEnricherPlaygroundRedirect() {
  redirect("/enricher-config/calculator");
}
