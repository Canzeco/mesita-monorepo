import { useRouter } from 'expo-router';
import {
  Camera,
  MapPin,
  QrCode,
  Sparkles,
  Star,
  TicketX,
} from 'lucide-react-native';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { PlacePickList } from '@/components/rewards/PlacePickList';
import { SavingsReveal } from '@/components/rewards/SavingsReveal';
import { TicketRow } from '@/components/rewards/TicketRow';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import type { Place } from '@/lib/api/places';
import {
  ACTIVE_TICKET_STATUSES,
  apiCreateTicket,
  apiListConsumerTickets,
  type ConsumerTicketRow,
} from '@/lib/api/tickets';
import { EFError } from '@/lib/ef';
import { useConsumerTickets } from '@/lib/hooks/useConsumerTickets';
import { TAB_SCROLL_PADDING_BOTTOM } from '@/lib/tab-layout';
import { useAuth } from '@/providers/auth';

// Rewards Wallet (MESITA-811 · 820 · 857) — web PayClient mirror. The wallet
// is now purely the DOOR: tapping a partner in New creates the ticket and
// navigates straight to THE ticket screen (/rewards/ticket/[id]); Pending and
// History are compact rows into the same screen. The venue pass modal and the
// in-list QR card died with MESITA-857 — one object, one surface. Guests with
// Instagram connected get the one create-time Story interstitial (MESITA-909;
// wantsStory can't be added later).

type Tab = 'new' | 'pending' | 'history';

export function PayClient({ userId }: { userId: string }) {
  const router = useRouter();
  const tickets = useConsumerTickets(userId);
  const { profile } = useAuth();
  const igConnected = Boolean(profile?.instagram_handle?.trim());

  // Default tab is DERIVED, not effect-set: Pending while a live ticket
  // exists, New otherwise. A manual tap pins the choice for the session.
  const [tabChoice, setTabChoice] = useState<Tab | null>(null);
  const tab: Tab = tabChoice ?? (tickets.active.length > 0 ? 'pending' : 'new');

  const activePlaceIds = useMemo(
    () => new Set(tickets.active.map((t) => t.project_id)),
    [tickets.active],
  );

  // ── Ticket creation: tap → create → navigate. ──
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [storyPlace, setStoryPlace] = useState<Place | null>(null);
  const [wantsStory, setWantsStory] = useState(false);

  const openTicket = useCallback(
    (id: string) => {
      setTabChoice('pending');
      router.push(`/rewards/ticket/${id}`);
    },
    [router],
  );

  const startTicket = useCallback(
    async (place: Place, withStory: boolean) => {
      setStartingId(place.id);
      setStartError(null);
      try {
        const res = await apiCreateTicket(place.id, withStory);
        void tickets.refresh();
        openTicket(res.ticket.id);
      } catch (err) {
        if (err instanceof EFError && err.code === 'already_open') {
          const fromBody = err.body?.ticketId;
          let id = typeof fromBody === 'string' ? fromBody : null;
          if (!id) {
            const rows = await apiListConsumerTickets().catch(
              () => [] as ConsumerTicketRow[],
            );
            id =
              rows.find(
                (t) =>
                  t.project_id === place.id &&
                  ACTIVE_TICKET_STATUSES.has(t.status),
              )?.id ?? null;
          }
          if (id) {
            openTicket(id);
            return;
          }
        }
        setStartError(
          err instanceof Error ? err.message : "Couldn't start your ticket.",
        );
      } finally {
        setStartingId(null);
      }
    },
    [tickets, openTicket],
  );

  const onPick = useCallback(
    (place: Place) => {
      const existing = tickets.active.find((t) => t.project_id === place.id);
      if (existing) {
        openTicket(existing.id);
        return;
      }
      if (igConnected) {
        setWantsStory(false);
        setStoryPlace(place);
        return;
      }
      void startTicket(place, false);
    },
    [tickets.active, igConnected, openTicket, startTicket],
  );

  // The paid beat (MESITA-808, 4A).
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
        <PitchSteps />

        {justPaid ? (
          <SavingsReveal
            placeName={justPaid.place?.name ?? 'the place'}
            savedCents={justPaid.discount_cents ?? 0}
            onDone={() => setJustPaid(null)}
          />
        ) : null}

        {/* Segmented control — filled track (MESITA-820). */}
        <View className="flex-row rounded-2xl bg-muted p-1" style={{ gap: 4 }}>
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
          <>
            {startError ? (
              <Text
                className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive"
                style={{ fontSize: 12.5 }}
              >
                {startError}
              </Text>
            ) : null}
            <PlacePickList
              activePlaceIds={activePlaceIds}
              busyPlaceId={startingId}
              onPick={onPick}
            />
          </>
        ) : tab === 'pending' ? (
          <View style={{ gap: 10 }}>
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
                  Pick the place you&apos;re visiting in New and your ticket
                  opens with its QR.
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
                <TicketRow
                  key={t.id}
                  ticket={t}
                  onOpen={() => openTicket(t.id)}
                />
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
                <TicketRow
                  key={t.id}
                  ticket={t}
                  onOpen={() => openTicket(t.id)}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Story interstitial — the ONE create-time choice (wantsStory). */}
      <FullScreenSheet
        visible={storyPlace !== null}
        onClose={() => setStoryPlace(null)}
        title="Add the Story bonus?"
        subtitle="Available with your connected Instagram — decide before the ticket opens."
      >
        <View className="flex-1 px-4 pt-4" style={{ gap: 16 }}>
          <Pressable
            onPress={() => setWantsStory((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: wantsStory }}
            className={`flex-row items-start rounded-2xl border px-3.5 py-3 ${
              wantsStory ? 'border-secondary/40 bg-secondary/5' : 'border-border'
            }`}
            style={{ gap: 12 }}
          >
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
              <Camera size={16} color="#cf0360" />
            </View>
            <View className="min-w-0 flex-1">
              <Text
                className="font-semibold text-foreground"
                style={{ fontSize: 13 }}
              >
                Post a tagged story at the table
              </Text>
              <Text
                className="text-muted-foreground"
                style={{ fontSize: 12, lineHeight: 16 }}
              >
                A bigger reward than your class rate — verified before it pays.
              </Text>
            </View>
            <View
              className={`mt-0.5 h-5 w-5 items-center justify-center rounded-full border ${
                wantsStory ? 'border-secondary bg-secondary' : 'border-border'
              }`}
            >
              {wantsStory ? (
                <Text className="font-bold text-white" style={{ fontSize: 10 }}>
                  ✓
                </Text>
              ) : null}
            </View>
          </Pressable>
          <Pressable
            disabled={startingId !== null}
            onPress={() => {
              const p = storyPlace;
              setStoryPlace(null);
              if (p) void startTicket(p, wantsStory);
            }}
            accessibilityRole="button"
            className="overflow-hidden rounded-xl active:opacity-90"
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
              {startingId ? <ActivityIndicator size="small" color="#fff" /> : null}
              <Text className="font-semibold text-white" style={{ fontSize: 14 }}>
                Open my ticket
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </FullScreenSheet>
    </>
  );
}

// The four steps — a RAIL, not a card (MESITA-826): numbered, connected by
// hairlines, instruction-weight. Pato's wording verbatim.
const PITCH_STEPS = [
  { Icon: MapPin, label: 'Pick place' },
  { Icon: Star, label: 'Post review' },
  { Icon: QrCode, label: 'Show QR' },
  { Icon: Sparkles, label: 'Pay less' },
] as const;

function PitchSteps() {
  return (
    <View className="flex-row items-start px-1" style={{ paddingTop: 4 }}>
      {PITCH_STEPS.map(({ Icon, label }, i) => (
        <React.Fragment key={label}>
          <View className="flex-1 items-center" style={{ gap: 6 }}>
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
              <Icon size={18} color="#cf0360" />
            </View>
            <Text
              className="text-center font-semibold text-foreground"
              style={{ fontSize: 11, lineHeight: 14 }}
            >
              <Text className="font-extrabold text-primary">{i + 1}</Text>{' '}
              {label}
            </Text>
          </View>
          {i < PITCH_STEPS.length - 1 ? (
            <View
              className="bg-border"
              style={{ height: 1, width: 12, marginTop: 20 }}
            />
          ) : null}
        </React.Fragment>
      ))}
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
