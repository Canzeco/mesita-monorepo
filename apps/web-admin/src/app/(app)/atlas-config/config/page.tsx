import { redirect } from "next/navigation";

// The Config/Playground tabs were retired 2026-08-01 — Atlas Config is one
// flat page now. Kept as a redirect so old links/bookmarks keep working.
export default function LegacyAtlasConfigTabRedirect() {
  redirect("/atlas-config");
}
