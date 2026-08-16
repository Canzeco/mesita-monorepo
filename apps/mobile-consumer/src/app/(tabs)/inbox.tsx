import { Bell, CalendarCheck, QrCode, ShoppingBag } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InboxNotificationsSection } from '@/components/inbox/InboxNotificationsSection';
import { InboxReservationsSection } from '@/components/inbox/InboxReservationsSection';
import { InboxVisitsSection } from '@/components/inbox/InboxVisitsSection';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShellWash } from '@/components/ui/HeroBackdrop';
import { SegmentNav, type SegmentItem } from '@/components/ui/SegmentNav';
import { useAuth } from '@/providers/auth';

// The Inbox tab — four sections, mirroring web app/(shell)/inbox/*.
//
// ORDER IS LOAD-BEARING (Pato, 2026-08-16): Visits · Orders · Reservations ·
// Notifications runs from the thing you're doing RIGHT NOW out to the passive
// feed. Don't re-sort by how built-out the sections are.
//
// Web makes these real nested routes so a section is linkable; here they are
// segments of one tab screen, which is the RN-native shape (a tab keeps its
// own stack, and deep links land via /inbox/* handled by the standalone
// route group). The route file is named `inbox` — it used to be
// `reservations`, which was the tab wearing a container's name while holding
// exactly one thing.
type Section = 'visits' | 'orders' | 'reservations' | 'notifications';

const SECTIONS: (SegmentItem & {
  key: Section;
  Icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
})[] = [
  { key: 'visits', title: 'Visits', Icon: QrCode },
  { key: 'orders', title: 'Orders', Icon: ShoppingBag },
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
          ) : section === 'orders' ? (
            // Parked: Orders has no backing concept anywhere in the stack yet
            // — no table, no Edge Function, no type. The section stays in the
            // nav because the four-section order IS the product statement,
            // and a gap in it would read as a bug.
            <EmptyState
              icon={ShoppingBag}
              title="Orders are coming"
              description="Order from any place by telling the Mesita agent what you want — no menu needed. It calls the place and confirms. Your orders will land here."
            />
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
