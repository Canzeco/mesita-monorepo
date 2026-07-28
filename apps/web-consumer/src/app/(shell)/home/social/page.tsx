import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Social feed is parked — redirect keeps deep links safe. Unpark via
// HomeModeNav + remounting SocialFeed (git history has the prior page body).
export default function HomeSocialPage() {
  redirect(CONSUMER_ROUTES.homeDefault);
}
