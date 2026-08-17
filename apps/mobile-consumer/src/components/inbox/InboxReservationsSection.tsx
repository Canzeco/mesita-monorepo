import { LinearGradient } from 'expo-linear-gradient';
import { CalendarCheck, type LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { ReservationsList } from '@/components/reservations/ReservationsList';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_GLOW } from '@/constants/brand';

// Inbox > Reservations — ONE feed (Pato, 2026-08-17: "remove upcoming and
// history, all in the same feed"), web parity.
//
// The Upcoming/History segmented control is gone: it was a second row of
// navigation stacked right under the Inbox section nav, chrome about chrome.
// The split survives as ORDER inside the list — what's coming next, then what
// already happened — instead of as a control.

export function InboxReservationsSection() {
  return (
    <View className="flex-1">
      <ReservationsList
        scope="all"
        empty={
          <ReservationsEmptyState
            icon={CalendarCheck}
            title="No reservations yet"
            body="Reserve a table from any place and Mesita calls to book it — your bookings show up here."
          />
        }
      />
    </View>
  );
}

function ReservationsEmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-6 py-16">
      <LinearGradient
        colors={[...GRADIENTS.pink]}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={[
          {
            width: 64,
            height: 64,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
          },
          SHADOW_GLOW,
        ]}
      >
        <Icon color="#fff" size={28} strokeWidth={2} />
      </LinearGradient>
      <View className="items-center gap-1.5">
        <Text className="font-display text-center text-xl font-semibold text-foreground">
          {title}
        </Text>
        <Text className="max-w-xs text-center text-sm leading-snug text-muted-foreground">
          {body}
        </Text>
      </View>
    </View>
  );
}
