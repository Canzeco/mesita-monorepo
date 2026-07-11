import { redirect } from "next/navigation";

// Bare /home → the default sub-route (swipe). Legacy ?mode= deep links
// (swipe / askAi / social / favorites) map to their new sub-route so old
// bookmarks and links keep working. The Home tab itself links straight to
// /home/swipe, so this hop is only hit by direct URLs / legacy links.
const MODE_SEGMENT: Record<string, string> = {
  swipe: "swipe",
  ai: "ai",
  askAi: "ai",
  social: "social",
  favorites: "favorites",
};

export default async function HomeIndex({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.mode;
  const mode = typeof raw === "string" ? raw : "";
  redirect(`/home/${MODE_SEGMENT[mode] ?? "swipe"}`);
}
