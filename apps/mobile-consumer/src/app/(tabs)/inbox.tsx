import { Bell, CalendarCheck, QrCode } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InboxNotificationsSection } from '@/components/inbox/InboxNotificationsSection';
import { InboxReservationsSection } from '@/components/inbox/InboxReservationsSection';
import { InboxVisitsSection } from '@/components/inbox/InboxVisitsSection';
import { ShellWash } from '@/components/ui/HeroBackdrop';
import { SegmentNav, type SegmentItem } from '@/components/ui/SegmentNav';
import { useAuth } from '@/providers/auth';

// The Inbox tab — three sections, mirroring web app/(shell)/inbox/*.
//
// ORDERS FOLDED INTO VISITS (MESITA-1389, 2026-09-06), mirroring web the same
// PR: it never had a table, an Edge Function or a type on either platform, so
// it was a segment that could never render anything. An order is a visit you
// didn't sit down for.
//
// ORDER IS LOAD-BEARING (Pato, 2026-08-16): Visits · Reservations ·
// Notifications runs from the thing you're doing RIGHT NOW out to the passive
// feed. Don't re-sort by how built-out the sections are. (Web reorders to
// lead with Alerts — see consumer-route-contract.ts; that reorder is a screen
// change the freeze forbids here, unlike this fold.)
//
// Web makes these real nested routes so a section is linkable; here they are
// segments of one tab screen, which is the RN-native shape (a tab keeps its
// own stack, and deep links land via /inbox/* handled by the standalone
// route group). The route file is named `inbox` — it used to be
// `reservations`, which was the tab wearing a container's name while holding
// exactly one thing.
type Section = 'visits' | 'reservations' | 'notifications';

const SECTIONS: (SegmentItem & {
  key: Section;
  Icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
})[] = [
  { key: 'visits', title: 'Visits', Icon: QrCode },
  { key: 'reservations', title: 'Reservations', Icon: CalendarCheck },
  { key: 'notifications', title: 'Notifications', Icon: Bell },
];

export default function InboxScreen() {
  const [section, setSection] = useState<Section>('visits');
  const { session } = useAuth();
  const userId = session?.user.id ?? '';

  return (
    <ShellWash>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View
          className="border-b border-border bg-background/90"
          style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 }}
        >
          <SegmentNav
            items={SECTIONS}
            value={section}
            onChange={(v) => setSection(v as Section)}
          />
        </View>

        <View style={{ flex: 1, minHeight: 0 }}>
          {section === 'visits' ? (
            <InboxVisitsSection userId={userId} />
          ) : section === 'reservations' ? (
            <InboxReservationsSection />
          ) : (
            <InboxNotificationsSection userId={userId} />
          )}
        </View>
      </SafeAreaView>
    </ShellWash>
  );
}
