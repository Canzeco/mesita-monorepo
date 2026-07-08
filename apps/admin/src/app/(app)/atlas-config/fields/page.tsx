import { redirect } from "next/navigation";

// Atlas Params became the flat /atlas-config page when Atlas Config and Enricher
// Config were split apart. Kept as a redirect so old links/bookmarks keep working.
export default function LegacyAtlasFieldsRedirect() {
  redirect("/atlas-config");
}
