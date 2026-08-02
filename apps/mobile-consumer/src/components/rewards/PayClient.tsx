import { MapPin, Plus, QrCode, Sparkles, TicketX } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { CheckTicketCard } from '@/components/rewards/CheckTicketCard';
import { ContextStrip } from '@/components/rewards/ContextStrip';
import { CreateTicketSheet } from '@/components/rewards/CreateTicketSheet';
import { HistoryTicketCard } from '@/components/rewards/HistoryTicketCard';
import { HowItWorksSheet } from '@/components/rewards/HowItWorksSheet';
import { MemberRow } from '@/components/rewards/MemberRow';
import { SavingsReveal } from '@/components/rewards/SavingsReveal';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { apiCancelTicket, type ConsumerTicketRow } from '@/lib/api/tickets';
import {
  computeRewardStats,
  useConsumerPayTickets,
} from '@/lib/hooks/useConsumerPayTickets';
import { useConsumerTickets } from '@/lib/hooks/useConsumerTickets';
import { TAB_SCROLL_PADDING_BOTTOM } from '@/lib/tab-layout';

// Rewards is a WALLET (MESITA-808, 1A) — web PayClient mirror: context strip
// → THE slot (live ticket QR / Start hero + pitch) → Ticket/History pills →
// MemberRow (2A: no passport QR). Education lives in HowItWorksSheet. Motion
// budget: verified pulse (card) + savings reveal (here) only.

type Tab = 'ticket' | 'history';

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
  const [tab, setTab] = useState<Tab>('ticket');
  const [createOpen, setCreateOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  const tickets = useConsumerTickets(userId);
  const notifications = useConsumerPayTickets(userId);
  const stats = useMemo(
    () => computeRewardStats(notifications.bundles, notifications.ticketMetaById),
    [notifications.bundles, notifications.ticketMetaById],
  );

  const cancelTicket = useCallback(
    async (ticketId: string) => {
      await apiCancelTicket(ticketId);
      await tickets.refresh();
    },
    [tickets],
  );

  // The paid beat (4A): a watched ticket flipping to revealed holds THE slot
  // as a savings reveal before settling into History.
  const [justPaid, setJustPaid] = useState<ConsumerTicketRow | null>(null);
  const prevActiveIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (tickets.status !== 'ready') return;
    const prev = prevActiveIdsRef.current;
    const revealed = tickets.history.find(
      (t) => t.status === 'revealed' && prev.has(t.id),
    );
    prevActiveIdsRef.current = new Set(tickets.active.map((t) => t.id));
    if (revealed) setJustPaid(revealed);
  }, [tickets.status, tickets.active, tickets.history]);

  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: TAB_SCROLL_PADDING_BOTTOM,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ContextStrip onOpenHow={() => setHowOpen(true)} />

        {justPaid ? (
          <SavingsReveal
            placeName={justPaid.place?.name ?? 'the place'}
            savedCents={justPaid.discount_cents ?? 0}
            onDone={() => setJustPaid(null)}
          />
        ) : null}

        {/* Ticket / History pills (5A) — ≥44px hit areas. */}
        <View className="flex-row rounded-2xl border border-border bg-card p-1">
          {(
            [
              { id: 'ticket', label: 'Ticket' },
              { id: 'history', label: 'History' },
            ] as const
          ).map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.id }}
              className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl px-1 ${
                tab === t.id ? 'bg-foreground' : ''
              }`}
              style={{ minHeight: 44 }}
            >
              <Text
                className={`font-semibold ${
                  tab === t.id ? 'text-background' : 'text-muted-foreground'
                }`}
                style={{ fontSize: 12.5 }}
              >
                {t.label}
              </Text>
              {t.id === 'ticket' && tickets.active.length > 0 ? (
                <View
                  className={`rounded-full px-1.5 ${
                    tab === 'ticket' ? 'bg-background/25' : 'bg-primary/10'
                  }`}
                >
                  <Text
                    className={`font-bold ${
                      tab === 'ticket' ? 'text-background' : 'text-primary'
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

        {tab === 'ticket' ? (
          <View style={{ gap: 12 }}>
            {tickets.status === 'loading' ? (
              <ActivityIndicator style={{ paddingVertical: 24 }} />
            ) : tickets.status === 'error' ? (
              <ErrorBox retry={tickets.retry} />
            ) : tickets.active.length === 0 ? (
              <EmptyPitch onStart={() => setCreateOpen(true)} />
            ) : (
              <>
                {tickets.active.map((t) => (
                  <CheckTicketCard key={t.id} ticket={t} onCancel={cancelTicket} />
                ))}
                <Pressable
                  onPress={() => setCreateOpen(true)}
                  accessibilityRole="button"
                  className="flex-row items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border"
                  style={{ minHeight: 44 }}
                >
                  <Plus size={16} color="#775254" />
                  <Text
                    className="font-semibold text-muted-foreground"
                    style={{ fontSize: 12.5 }}
                  >
                    Another place
                  </Text>
                </Pressable>
              </>
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

        {/* Identity row — the demoted passport (2A: text code, no QR). */}
        <MemberRow code={code} name={name} instagramHandle={instagramHandle} />
      </ScrollView>

      <HowItWorksSheet
        visible={howOpen}
        onClose={() => setHowOpen(false)}
        stats={stats}
      />

      <CreateTicketSheet
        // Remount per open: fresh state without a reset effect.
        key={String(createOpen)}
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          await tickets.refresh();
          setTab('ticket');
        }}
      />
    </>
  );
}

// The empty state IS the pitch (3A): the three-step story plus the one
// gradient hero this page is allowed when no ticket is live.
function EmptyPitch({ onStart }: { onStart: () => void }) {
  return (
    <View style={{ gap: 12 }}>
      <View className="flex-row rounded-2xl border border-border bg-card px-3 py-4">
        <PitchStep icon={<MapPin size={18} color="#cf0360" />} label="Pick the place" />
        <PitchStep icon={<QrCode size={18} color="#cf0360" />} label="Show your QR" />
        <PitchStep icon={<Sparkles size={18} color="#cf0360" />} label="Pay less" />
      </View>
      <Pressable
        onPress={onStart}
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
            minHeight: 48,
          }}
        >
          <Plus size={16} color="#fff" strokeWidth={2.5} />
          <Text className="font-semibold text-white" style={{ fontSize: 14 }}>
            Start a ticket
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function PitchStep({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View className="flex-1 items-center" style={{ gap: 6 }}>
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-secondary/10">
        {icon}
      </View>
      <Text
        className="text-center font-semibold text-foreground"
        style={{ fontSize: 11, lineHeight: 14 }}
      >
        {label}
      </Text>
    </View>
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
