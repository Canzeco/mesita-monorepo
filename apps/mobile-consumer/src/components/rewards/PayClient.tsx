import { Plus, TicketX } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { CheckTicketCard } from '@/components/rewards/CheckTicketCard';
import { CreateTicketSheet } from '@/components/rewards/CreateTicketSheet';
import { HistoryTicketCard } from '@/components/rewards/HistoryTicketCard';
import { MyQrCard } from '@/components/rewards/MyQrCard';
import { RewardProgramCard } from '@/components/rewards/RewardProgramCard';
import { RewardsTopCards } from '@/components/rewards/RewardsTopCards';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { apiCancelTicket } from '@/lib/api/tickets';
import {
  computeRewardStats,
  useConsumerPayTickets,
} from '@/lib/hooks/useConsumerPayTickets';
import {
  derivePassTicketFromRows,
  useConsumerTickets,
} from '@/lib/hooks/useConsumerTickets';
import { TAB_SCROLL_PADDING_BOTTOM } from '@/lib/tab-layout';

// Rewards — Tickets v2 (MESITA-806), web PayClient mirror: program card +
// passport, then the TICKET-driven New/History tabs. New = live tickets (the
// QR is the ticket: mesita.ai/check/<code>) + the create flow; History =
// closed visits. Notifications stay as the bill poll + scorecard source.

type Tab = 'new' | 'history';

export function PayClient({
  userId,
  code,
  name,
  instagramHandle,
}: {
  userId: string;
  code: string;
  name?: string;
  instagramHandle?: string | null;
}) {
  const [tab, setTab] = useState<Tab>('new');
  const [createOpen, setCreateOpen] = useState(false);

  const tickets = useConsumerTickets(userId);
  const notifications = useConsumerPayTickets(userId);
  const stats = useMemo(
    () => computeRewardStats(notifications.bundles, notifications.ticketMetaById),
    [notifications.bundles, notifications.ticketMetaById],
  );
  const activeTicket = useMemo(
    () => derivePassTicketFromRows(tickets.active),
    [tickets.active],
  );

  const cancelTicket = useCallback(
    async (ticketId: string) => {
      await apiCancelTicket(ticketId);
      await tickets.refresh();
    },
    [tickets],
  );

  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: TAB_SCROLL_PADDING_BOTTOM,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <RewardProgramCard />
        <RewardsTopCards />
        <MyQrCard
          code={code}
          name={name}
          instagramHandle={instagramHandle}
          stats={stats}
          activeTicket={activeTicket}
        />

        {/* New / History tabs (web two-pill pattern). */}
        <View className="flex-row rounded-2xl border border-border bg-card p-1">
          {(
            [
              { id: 'new', label: 'New' },
              { id: 'history', label: 'History' },
            ] as const
          ).map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.id }}
              className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl px-1 py-1.5 ${
                tab === t.id ? 'bg-foreground' : ''
              }`}
            >
              <Text
                className={`font-medium ${
                  tab === t.id ? 'text-background' : 'text-muted-foreground'
                }`}
                style={{ fontSize: 12 }}
              >
                {t.label}
              </Text>
              {t.id === 'new' && tickets.active.length > 0 ? (
                <View
                  className={`rounded-full px-1.5 ${
                    tab === 'new' ? 'bg-background/25' : 'bg-primary/10'
                  }`}
                >
                  <Text
                    className={`font-bold ${
                      tab === 'new' ? 'text-background' : 'text-primary'
                    }`}
                    style={{ fontSize: 10 }}
                  >
                    {tickets.active.length}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>

        {tab === 'new' ? (
          <View style={{ gap: 12 }}>
            <Pressable
              onPress={() => setCreateOpen(true)}
              accessibilityRole="button"
              className="overflow-hidden rounded-2xl active:opacity-90"
            >
              <LinearGradient
                colors={[...GRADIENTS.pink]}
                start={GRADIENT_DIAGONAL.start}
                end={GRADIENT_DIAGONAL.end}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 14,
                }}
              >
                <Plus size={16} color="#fff" strokeWidth={2.5} />
                <Text className="font-semibold text-white" style={{ fontSize: 14 }}>
                  Start a ticket
                </Text>
              </LinearGradient>
            </Pressable>

            {tickets.status === 'loading' ? (
              <ActivityIndicator style={{ paddingVertical: 24 }} />
            ) : tickets.status === 'error' ? (
              <ErrorBox retry={tickets.retry} />
            ) : tickets.active.length === 0 ? (
              <Text
                className="px-2 py-4 text-center text-muted-foreground"
                style={{ fontSize: 12.5, lineHeight: 19 }}
              >
                No live ticket. Start one when you sit down — pick the place,
                show the QR, and your discount applies at the bill.
              </Text>
            ) : (
              tickets.active.map((t) => (
                <CheckTicketCard key={t.id} ticket={t} onCancel={cancelTicket} />
              ))
            )}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {tickets.status === 'loading' ? (
              <ActivityIndicator style={{ paddingVertical: 24 }} />
            ) : tickets.status === 'error' ? (
              <ErrorBox retry={tickets.retry} />
            ) : tickets.history.length === 0 ? (
              <View className="items-center gap-2 px-2 py-8">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-muted">
                  <TicketX size={20} color="#775254" />
                </View>
                <Text className="text-muted-foreground" style={{ fontSize: 12.5 }}>
                  Your closed visits will land here.
                </Text>
              </View>
            ) : (
              tickets.history.map((t) => (
                <HistoryTicketCard key={t.id} ticket={t} />
              ))
            )}
          </View>
        )}
      </ScrollView>

      <CreateTicketSheet
        // Remount per open: fresh state without a reset effect.
        key={String(createOpen)}
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          await tickets.refresh();
          setTab('new');
        }}
      />
    </>
  );
}

function ErrorBox({ retry }: { retry: () => void }) {
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <Text className="text-muted-foreground" style={{ fontSize: 12.5 }}>
        Couldn&apos;t load your tickets.
      </Text>
      <Pressable onPress={retry} accessibilityRole="button">
        <Text className="font-semibold text-primary" style={{ fontSize: 12.5 }}>
          Retry
        </Text>
      </Pressable>
    </View>
  );
}
