import { MapPin, QrCode, Sparkles, TicketX } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { CheckTicketCard } from '@/components/rewards/CheckTicketCard';
import { HistoryTicketCard } from '@/components/rewards/HistoryTicketCard';
import { PlacePickList } from '@/components/rewards/PlacePickList';
import { SavingsReveal } from '@/components/rewards/SavingsReveal';
import { VenuePassModal } from '@/components/rewards/VenuePassModal';
import { WalletHeader } from '@/components/rewards/WalletHeader';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import type { Place } from '@/lib/api/places';
import { apiCancelTicket, type ConsumerTicketRow } from '@/lib/api/tickets';
import { useConsumerTickets } from '@/lib/hooks/useConsumerTickets';
import { TAB_SCROLL_PADDING_BOTTOM } from '@/lib/tab-layout';

// Rewards Wallet v3 (MESITA-811) — web PayClient mirror: identity header
// (name + class, nothing else) → the three steps → New / Pending / History.
// New lists every partner place; tapping one opens the venue pass modal,
// which reuses-or-creates the ticket and shows the QR. Education stays on
// Me > Help (MESITA-809); motion budget carries over from MESITA-808.

type Tab = 'new' | 'pending' | 'history';

export function PayClient({
  userId,
  code,
  name,
}: {
  userId: string;
  code: string;
  name?: string;
}) {
  const tickets = useConsumerTickets(userId);

  // Default tab is DERIVED, not effect-set: Pending while a live ticket
  // exists, New otherwise. A manual tap pins the choice for the session.
  const [tabChoice, setTabChoice] = useState<Tab | null>(null);
  const tab: Tab = tabChoice ?? (tickets.active.length > 0 ? 'pending' : 'new');

  const [passPlace, setPassPlace] = useState<Place | null>(null);

  const activePlaceIds = useMemo(
    () => new Set(tickets.active.map((t) => t.project_id)),
    [tickets.active],
  );

  const cancelTicket = useCallback(
    async (ticketId: string) => {
      await apiCancelTicket(ticketId);
      await tickets.refresh();
    },
    [tickets],
  );

  // The paid beat (MESITA-808, 4A): a watched ticket flipping to revealed
  // holds a savings reveal before settling into History.
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
        <WalletHeader name={name} />

        <PitchSteps />

        {justPaid ? (
          <SavingsReveal
            placeName={justPaid.place?.name ?? 'the place'}
            savedCents={justPaid.discount_cents ?? 0}
            onDone={() => setJustPaid(null)}
          />
        ) : null}

        {/* New / Pending / History pills — ≥44px hit areas. */}
        <View className="flex-row rounded-2xl border border-border bg-card p-1">
          {(
            [
              { id: 'new', label: 'New' },
              { id: 'pending', label: 'Pending' },
              { id: 'history', label: 'History' },
            ] as const
          ).map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTabChoice(t.id)}
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
              {t.id === 'pending' && tickets.active.length > 0 ? (
                <View
                  className={`rounded-full px-1.5 ${
                    tab === 'pending' ? 'bg-background/25' : 'bg-primary/10'
                  }`}
                >
                  <Text
                    className={`font-bold ${
                      tab === 'pending' ? 'text-background' : 'text-primary'
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
          <PlacePickList
            activePlaceIds={activePlaceIds}
            onPick={(place) => setPassPlace(place)}
          />
        ) : tab === 'pending' ? (
          <View style={{ gap: 12 }}>
            {tickets.status === 'loading' ? (
              <ActivityIndicator style={{ paddingVertical: 24 }} />
            ) : tickets.status === 'error' ? (
              <ErrorBox retry={tickets.retry} />
            ) : tickets.active.length === 0 ? (
              <View className="items-center gap-3 rounded-2xl border border-border bg-card px-6 py-10">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <QrCode size={24} color="#cf0360" />
                </View>
                <Text
                  className="font-semibold text-foreground"
                  style={{ fontSize: 14 }}
                >
                  No live ticket
                </Text>
                <Text
                  className="text-center text-muted-foreground"
                  style={{ fontSize: 12.5, lineHeight: 17, maxWidth: 280 }}
                >
                  Pick the place you&apos;re visiting in New and your QR is
                  ready to scan.
                </Text>
                <Pressable
                  onPress={() => setTabChoice('new')}
                  accessibilityRole="button"
                  className="mt-1 overflow-hidden rounded-xl active:opacity-90"
                >
                  <LinearGradient
                    colors={[...GRADIENTS.pink]}
                    start={GRADIENT_DIAGONAL.start}
                    end={GRADIENT_DIAGONAL.end}
                    style={{ paddingHorizontal: 20, paddingVertical: 10 }}
                  >
                    <Text
                      className="font-semibold text-white"
                      style={{ fontSize: 13 }}
                    >
                      Browse places
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
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

      <VenuePassModal
        // Remount per venue: fresh modal state without reset effects.
        key={passPlace?.id ?? 'closed'}
        place={passPlace}
        code={code}
        tickets={tickets}
        onClose={() => setPassPlace(null)}
        onTicketStarted={() => setTabChoice('pending')}
      />
    </>
  );
}

// The three steps — always visible per Pato's spec (the pitch is the
// program's whole story: pick the place, show your QR, pay less).
function PitchSteps() {
  return (
    <View className="flex-row rounded-2xl border border-border bg-card px-3 py-4">
      <PitchStep icon={<MapPin size={18} color="#cf0360" />} label="Pick the place" />
      <PitchStep icon={<QrCode size={18} color="#cf0360" />} label="Show your QR" />
      <PitchStep icon={<Sparkles size={18} color="#cf0360" />} label="Pay less" />
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
