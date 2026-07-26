import { redirect } from "next/navigation";

// Atlas Config folded back into a single flat page (Playground tab removed).
// Kept as a redirect so old "Config" tab links/bookmarks keep working.
export default function LegacyAtlasConfigTabRedirect() {
  redirect("/atlas-config");
}
