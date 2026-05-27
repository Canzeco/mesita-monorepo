import { redirect } from "next/navigation";

// /discover/search merged into /discover/ai when the Discover strip
// collapsed Search + AI into a single "AI Search" tab. The Don Memo
// shell already handles both single-word lookups and full sentences,
// so two separate surfaces was a false choice. Kept as a redirect for
// old links.
export default function DiscoverSearchRedirect() {
  redirect("/discover/ai");
}
