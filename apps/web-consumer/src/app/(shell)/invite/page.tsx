import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// The referral page is named Share (canonical /share). /invite is the legacy
// path — kept as a redirect for saved links and the old bottom-nav entry.
export default function InviteLegacyPage() {
  redirect(CONSUMER_ROUTES.share);
}
