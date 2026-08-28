import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Chat is parked with the rest of Home. Unpark via HomeModeNav + remounting
// AskAiTab (the page body is in git history).
export default function HomeChatPage() {
  redirect(CONSUMER_ROUTES.homeDefault);
}
