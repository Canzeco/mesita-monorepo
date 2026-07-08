import { redirect } from "next/navigation";

// Atlas Params moved to the /atlas-config/config tab when Atlas Config and
// Enricher Config were split into separate pages. Kept as a redirect so old
// links/bookmarks keep working.
export default function LegacyAtlasFieldsRedirect() {
  redirect("/atlas-config/config");
}
