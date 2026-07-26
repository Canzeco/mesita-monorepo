import { redirect } from "next/navigation";

// Enricher Calculator split out of Atlas Config into the standalone Enricher
// Config page. Kept as a redirect so old links/bookmarks keep working.
export default function LegacyAtlasCalculatorRedirect() {
  redirect("/enricher-config/playground");
}
