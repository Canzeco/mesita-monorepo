import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Social is parked with the rest of Home. Unpark via HomeModeNav + remounting
// SocialFeed (git history has the prior page body).
export default function HomeSocialPage() {
  redirect(CONSUMER_ROUTES.homeDefault);
}
