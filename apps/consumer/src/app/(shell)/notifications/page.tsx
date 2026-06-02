import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export default function NotificationsRedirect() {
  redirect(CONSUMER_ROUTES.inbox.mine);
}
