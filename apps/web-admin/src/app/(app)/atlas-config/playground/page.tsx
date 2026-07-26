import { redirect } from "next/navigation";

// The Atlas field-permission previewer was removed — Atlas is a single flat page.
// Kept as a redirect so old "Playground" links/bookmarks keep working.
export default function LegacyAtlasPlaygroundRedirect() {
  redirect("/atlas-config");
}
