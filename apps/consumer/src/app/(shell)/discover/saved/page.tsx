import { redirect } from "next/navigation";

// Saved moved back out of Discover and is now a top-level BottomNav
// surface again (the "byebye coupons-as-entity" checkpoint). Keep this
// stub so any DiscoverTabs link, bookmark, or share image that still
// targets /discover/saved soft-lands on the new home.
export default function DiscoverSavedRedirect() {
  redirect("/saved");
}
