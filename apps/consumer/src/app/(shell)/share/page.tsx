import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// The page is named Invite (the noun); sharing is just the action on it.
// /share was the old canonical path — kept as a redirect for saved links.
export default function ShareLegacyPage() {
  redirect(CONSUMER_ROUTES.invite);
}
