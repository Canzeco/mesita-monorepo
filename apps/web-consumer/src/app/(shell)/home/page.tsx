import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Bare /home → the default sub-route (swipe). Legacy ?mode= deep links
// (swipe / askAi / social / favorites) map to their new sub-route so old
// bookmarks and links keep working. The Home tab itself links straight to
// /home/swipe, so this hop is only hit by direct URLs / legacy links.
const MODE_SEGMENT = {
  swipe: "swipe",
  ai: "chat",
  askAi: "chat",
  social: "social",
  favorites: "favorites",
} as const satisfies Record<string, keyof typeof CONSUMER_ROUTES.homeTabs>;

export default async function HomeIndex({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.mode;
  const mode = typeof raw === "string" ? raw : "";
  const segment =
    MODE_SEGMENT[mode as keyof typeof MODE_SEGMENT] ?? "swipe";
  redirect(CONSUMER_ROUTES.homeTabs[segment]);
}
