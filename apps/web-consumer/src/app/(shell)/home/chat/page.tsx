import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Ask AI is parked — redirect keeps deep links safe. Unpark via HomeModeNav
// + remounting AskAiTab (git history has the prior page body).
export default function HomeAiPage() {
  redirect(CONSUMER_ROUTES.homeDefault);
}
