import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Bare /inbox has no content of its own — land on the default section.
export default function InboxIndexPage() {
  redirect(CONSUMER_ROUTES.inboxDefault);
}
