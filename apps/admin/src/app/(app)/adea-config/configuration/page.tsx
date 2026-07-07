import { redirect } from "next/navigation";

// Merged into the unified "Atlas & Enricher Config" page (MESITA — enricher
// console redesign). Kept as a redirect so old links/bookmarks keep working.
export default function LegacyAdeaConfigurationRedirect() {
  redirect("/atlas-config/configuration");
}
