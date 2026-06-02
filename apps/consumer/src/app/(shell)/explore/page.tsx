import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export default function ExploreIndex() {
  redirect(CONSUMER_ROUTES.explore.swipe);
}
