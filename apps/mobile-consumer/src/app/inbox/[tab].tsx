import { Redirect } from 'expo-router';

import { inboxTabPath } from '@/lib/consumer-route-contract';

// Legacy Inbox deep links — /inbox/mine, /inbox/global and their pre-rename
// aliases. Notifications is now a SECTION of the Inbox tab rather than its
// own screen (the body moved to components/inbox/InboxNotificationsSection,
// shared with the tab), so every one of these lands on the tab.
export default function InboxLegacyTabScreen() {
  return <Redirect href={inboxTabPath()} />;
}
