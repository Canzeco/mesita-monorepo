import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Social stays Soon (Pato, 2026-08-27). No events engine yet. Unpark via
// HomeModeNav + remounting SocialFeed (the page body is on disk).
export default function HomeSocialPage() {
  redirect(CONSUMER_ROUTES.homeDefault);
}
