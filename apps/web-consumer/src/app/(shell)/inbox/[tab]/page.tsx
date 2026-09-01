import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Legacy Inbox aliases. The five real sections (credits / visits / orders /
// reservations / notifications) are STATIC segments and win the match, so
// this dynamic route only ever sees old paths:
//
//   /inbox/mine · /inbox/global                 (the notifications pair)
//   /inbox/my-activity · /inbox/global-activity (their pre-rename names)
//
// All of them are notifications, and anything else unknown lands on the
// default section rather than 404ing.
export default async function InboxLegacyTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  const NOTIFICATION_ALIASES = new Set([
    "mine",
    "global",
    "my-activity",
    "global-activity",
  ]);
  redirect(
    NOTIFICATION_ALIASES.has(tab)
      ? CONSUMER_ROUTES.inbox.notifications
      : CONSUMER_ROUTES.inboxDefault,
  );
}
