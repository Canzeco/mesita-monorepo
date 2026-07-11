import { redirect } from "next/navigation";

// The Enricher pipeline params now live on the standalone Enricher Config page.
// Kept as a redirect so old links/bookmarks keep working.
export default function LegacyAdeaConfigurationRedirect() {
  redirect("/enricher-config/config");
}
