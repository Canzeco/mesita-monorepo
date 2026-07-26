import { redirect } from "next/navigation";

// Atlas Params is now the flat Atlas Config page. Kept as a redirect so old
// links/bookmarks keep working.
export default function LegacyAtlasFieldsRedirect() {
  redirect("/atlas-config");
}
