import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export default function InviteLegacyPage() {
  redirect(CONSUMER_ROUTES.share);
}
