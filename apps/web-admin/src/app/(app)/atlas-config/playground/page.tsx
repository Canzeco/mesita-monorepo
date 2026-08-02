import { redirect } from "next/navigation";

// The Playground was retired 2026-08-01 — its "who can edit" per-writer
// filter was redundant with the matrix already on the main page. Kept as a
// redirect so old links/bookmarks keep working.
export default function LegacyAtlasPlaygroundRedirect() {
  redirect("/atlas-config");
}
