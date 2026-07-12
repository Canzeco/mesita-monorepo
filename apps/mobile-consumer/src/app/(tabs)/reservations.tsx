import { LinearGradient } from 'expo-linear-gradient';
import { CalendarCheck, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShellWash } from '@/components/ui/HeroBackdrop';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_GLOW } from '@/constants/brand';

// Parked reservations surface — web `/saved/reservations` parity:
// Upcoming / History segment + polished empty states (MESITA-569).
// Tab bar navigates here (Rewards alone stays behind ComingSoonModal).

type Tab = 'upcoming' | 'history';

const TABS: { id: Tab; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'history', label: 'History' },
];

export default function ReservationsScreen() {
  const [tab, setTab] = useState<Tab>('upcoming');

  return (
    <ShellWash>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View className="px-4 pt-4">
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
      </SafeAreaView>
    </ShellWash>
  );
}

function UpcomingBody() {
  return (
    <ReservationsEmptyState
      icon={CalendarCheck}
      eyebrow="Coming soon"
      title="No upcoming reservations"
      body="Booking a table straight from Mesita is on the way. We will let you know the moment reservations go live."
    />
  );
}

function HistoryBody() {
  return (
    <ReservationsEmptyState
      icon={Clock}
      title="No past reservations"
      body="Your dining history will show up here once you have booked and visited a place through Mesita."
    />
  );
}

function ReservationsEmptyState({
  icon: Icon,
  eyebrow,
  title,
  body,
}: {
  icon: typeof CalendarCheck;
  eyebrow?: string;
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
        {eyebrow ? (
          <Text
            className="font-semibold uppercase text-primary"
            style={{ fontSize: 11, letterSpacing: 1.8 }}
          >
            {eyebrow}
          </Text>
        ) : null}
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
