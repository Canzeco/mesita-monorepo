import { LinearGradient } from 'expo-linear-gradient';
import { CalendarCheck, Clock, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ReservationsList } from '@/components/reservations/ReservationsList';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_GLOW } from '@/constants/brand';

// Inbox > Reservations — Upcoming / History (web parity with
// app/(shell)/inbox/reservations). Booking is live (MESITA-715): each tab
// reads consumer-web-list-reservations for its scope.
//
// This used to be the whole `reservations` TAB screen. It became a section
// when Inbox grew four of them; the reservation DETAIL route did not move.

type Tab = 'upcoming' | 'history';

const TABS: { id: Tab; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'history', label: 'History' },
];

export function InboxReservationsSection() {
  const [tab, setTab] = useState<Tab>('upcoming');

  return (
    <View className="flex-1">
      <View className="px-4 pt-3">
        <View className="flex-row gap-0 rounded-2xl border border-border bg-card p-1">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={`flex-1 items-center justify-center rounded-xl px-1 py-1.5 ${
                  active ? 'bg-foreground' : ''
                }`}
              >
                <Text
                  className={`text-center text-[12px] font-medium ${
                    active ? 'text-background' : 'text-muted-foreground'
                  }`}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="min-h-0 flex-1">
        {tab === 'upcoming' ? <UpcomingBody /> : <HistoryBody />}
      </View>
    </View>
  );
}

function UpcomingBody() {
  return (
    <ReservationsList
      scope="upcoming"
      empty={
        <ReservationsEmptyState
          icon={CalendarCheck}
          title="No upcoming reservations"
          body="Reserve a table from any place and Mesita calls to book it — your upcoming bookings show up here."
        />
      }
    />
  );
}

function HistoryBody() {
  return (
    <ReservationsList
      scope="past"
      empty={
        <ReservationsEmptyState
          icon={Clock}
          title="No past reservations"
          body="Your dining history will show up here once you've booked and visited a place through Mesita."
        />
      }
    />
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
