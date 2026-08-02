import { redirect } from "next/navigation";

// The "Playground" tab was renamed back to "Calculator" (2026-08-01) — it
// always was one: price and time one enrichment run at the current settings.
// Kept as a redirect so old links/bookmarks keep working.
export default function LegacyEnricherPlaygroundRedirect() {
  redirect("/enricher-config/calculator");
}
