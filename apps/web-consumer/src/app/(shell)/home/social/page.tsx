import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Social is parked with the rest of Home. Unpark via HomeModeNav + remounting
// SocialFeed (the page body is in git history).
export default function HomeSocialPage() {
  redirect(CONSUMER_ROUTES.homeDefault);
}
