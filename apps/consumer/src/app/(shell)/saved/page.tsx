import { redirect } from "next/navigation";

// /saved is gone as a top-level route — Saved is now a Discover sub-tab.
// Keeping this stub for old bookmarks / pasted links / share images that
// still point at /saved; they soft-land in the new home.
export default function SavedRedirect() {
  redirect("/discover/saved");
}
