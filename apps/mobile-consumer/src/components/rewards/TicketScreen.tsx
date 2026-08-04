// THE TICKET (MESITA-857) — mobile mirror of web TicketScreen: one
// full-screen object for the whole lifecycle, per Notion Main §4.4. Place
// hero → class-tinted pass with the QR → task checklist → reward strip; the
// sections change with state instead of three surfaces drifting apart.
// Welcome Visit is NOT a task row (server-detected at billing); proof
// screenshots remain DEMO_SCREENSHOT_URL (MESITA-824); Mesita-review done
// state is session-local; the report button waits for MESITA-843.

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Check,
  PartyPopper,
  Star,
  Store,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import {
  TicketReviewForm,
  type TicketReviewDraft,
} from '@/components/rewards/TicketReviewForm';
import { formatCurrency, submitTicketReview } from '@/lib/api/pay';
import {
  ACTIVE_TICKET_STATUSES,
  apiCancelTicket,
  apiSubmitReview,
  apiSubmitStory,
  apiSubmitTicketTotal,
  checkUrlForCode,
  type ConsumerTicketRow,
} from '@/lib/api/tickets';
import { classProperLabel } from '@/lib/consumer-classes';
import { strategyForPlaceRow } from '@/lib/promo-rates';
import {
  REWARD_SEGMENT_BY_KEY,
  peakRateForClass,
  type RewardClassKey,
} from '@/lib/reward-segments';
import { useConsumerTickets } from '@/lib/hooks/useConsumerTickets';
import { useAuth } from '@/providers/auth';

const PASS_GRADIENTS: Record<string, [string, string, string]> = {
  standard: ['#ff7a45', '#ff4d6d', '#ff2d78'],
  premium: ['#ff7a45', '#ff3d73', '#a13cf0'],
  influencer: ['#ff7a45', '#4aa8ff', '#2f7fd6'],
  aura: ['#ff7a45', '#ffb03d', '#e0982e'],
};

// awaiting_story is GONE (MESITA-849/#591): tasks are self-attested before
// the scan, so a ticket is only ever open or awaiting payment while live.
function statusLine(t: ConsumerTicketRow): string {
  switch (t.status) {
    case 'open':
      return 'Show this QR — staff scan it to start your visit.';
    case 'awaiting_payment_confirm':
      return 'All set — pay the discounted total at the table.';
    default:
      return t.status;
  }
}

type TaskState = 'todo' | 'busy' | 'checking' | 'done' | 'rejected';

function taskStateFor(v: string | null | undefined): TaskState {
  if (v == null || v === 'not_required' || v === 'pending') return 'todo';
  if (v === 'submitted') return 'checking';
  if (v === 'ai_rejected' || v === 'staff_rejected') return 'rejected';
  return 'done';
}

function TaskRow({
  Icon,
  title,
  hint,
  reward,
  state,
  onDo,
}: {
  Icon: typeof Star;
  title: string;
  hint: string;
  reward: string;
  state: TaskState;
  onDo?: () => void;
}) {
  const done = state === 'done';
  const actionable = (state === 'todo' || state === 'rejected') && !!onDo;
  return (
    <Pressable
      disabled={!actionable}
      onPress={onDo}
      accessibilityRole="button"
      className={`flex-row items-center rounded-2xl px-3.5 py-3 ${
        done ? 'bg-emerald-500/10' : 'bg-muted/40'
      } ${actionable ? 'active:scale-[0.99]' : ''}`}
      style={{ minHeight: 56, gap: 12 }}
    >
      <View
        className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
          done ? 'border-emerald-500 bg-emerald-500' : 'border-border'
        }`}
      >
        {state === 'busy' || state === 'checking' ? (
          <ActivityIndicator size="small" />
        ) : done ? (
          <Check size={14} color="#fff" strokeWidth={3} />
        ) : null}
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Icon size={16} color={done ? '#047857' : '#cf0360'} />
          <Text
            className={`font-bold ${done ? 'text-emerald-800' : 'text-foreground'}`}
            numberOfLines={1}
            style={{ fontSize: 13.5, flexShrink: 1 }}
          >
            {title}
          </Text>
        </View>
        <Text
          className="mt-0.5 text-muted-foreground"
          numberOfLines={1}
          style={{ fontSize: 11.5 }}
        >
          {state === 'checking'
            ? 'Sent — being checked'
            : state === 'rejected'
              ? 'Not accepted — try again'
              : done
                ? 'Done'
                : hint}
        </Text>
      </View>
      <Text
        className={`font-extrabold ${done ? 'text-emerald-700' : 'text-foreground'}`}
        style={{ fontSize: 15 }}
      >
        {reward}
      </Text>
    </Pressable>
  );
}

export function TicketScreen({
  userId,
  ticketId,
}: {
  userId: string;
  ticketId: string;
}) {
  const router = useRouter();
  const tickets = useConsumerTickets(userId);
  const { consumerClass } = useAuth();
  const classKey = (consumerClass?.class ?? 'standard') as RewardClassKey;

  const ticket = useMemo(
    () =>
      tickets.active.find((t) => t.id === ticketId) ??
      tickets.history.find((t) => t.id === ticketId) ??
      null,
    [tickets.active, tickets.history, ticketId],
  );

  const scanned = ticket?.first_scanned_at != null;
  const wasScannedRef = useRef(scanned);
  useEffect(() => {
    // Mobile keeps the vibration beat only (no CSS pulse in RN).
    wasScannedRef.current = scanned;
  }, [scanned]);

  const [acting, setActing] = useState<'story' | 'review' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const runProof = useCallback(
    async (kind: 'story' | 'review') => {
      setActing(kind);
      setActionError(null);
      try {
        if (kind === 'story') await apiSubmitStory(ticketId);
        else await apiSubmitReview(ticketId);
        await tickets.refresh();
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Couldn't send that just yet.",
        );
      } finally {
        setActing(null);
      }
    },
    [ticketId, tickets],
  );

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  const [reviewDraft, setReviewDraft] = useState<TicketReviewDraft>({
    food: 0,
    service: 0,
    ambiance: 0,
    value: 0,
    overall: 0,
    comments: '',
  });
  const submitMesitaReview = useCallback(async () => {
    setReviewBusy(true);
    setActionError(null);
    try {
      await submitTicketReview({ ticketId, ...reviewDraft });
      setReviewDone(true);
      setReviewOpen(false);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Couldn't save your review.",
      );
    } finally {
      setReviewBusy(false);
    }
  }, [ticketId, reviewDraft]);

  // v3b amount fallback (MESITA-850): the staff bill is optional, so a
  // closed ticket may carry no amount. Ask the guest once — a record for
  // their savings history, never a money movement.
  const [totalDraft, setTotalDraft] = useState('');
  const [totalBusy, setTotalBusy] = useState(false);
  const submitTotal = useCallback(async () => {
    const pesos = Number(totalDraft.replace(/[,$\s]/g, ''));
    if (!Number.isFinite(pesos) || pesos <= 0) {
      setActionError('Type the bill total in pesos.');
      return;
    }
    setTotalBusy(true);
    setActionError(null);
    try {
      await apiSubmitTicketTotal(ticketId, Math.round(pesos * 100));
      await tickets.refresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Couldn't save that just yet.",
      );
    } finally {
      setTotalBusy(false);
    }
  }, [ticketId, tickets, totalDraft]);

  const [cancelling, setCancelling] = useState(false);
  const cancel = useCallback(async () => {
    setCancelling(true);
    try {
      await apiCancelTicket(ticketId);
      await tickets.refresh();
      router.back();
    } catch {
      setCancelling(false);
    }
  }, [ticketId, tickets, router]);

  if (tickets.status === 'loading' && !ticket) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#fb2b7b" />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ gap: 12 }}>
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-muted">
          <XCircle size={24} color="#775254" />
        </View>
        <Text className="font-semibold text-foreground" style={{ fontSize: 15 }}>
          Ticket not found
        </Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          className="overflow-hidden rounded-xl active:opacity-90"
        >
          <LinearGradient
            colors={PASS_GRADIENTS.standard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingHorizontal: 20, paddingVertical: 10 }}
          >
            <Text className="font-semibold text-white" style={{ fontSize: 13 }}>
              Back to Rewards
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  const live = ACTIVE_TICKET_STATUSES.has(ticket.status);
  const closed = !live;
  const saved = ticket.status === 'revealed';
  const cancelled = ticket.status === 'cancelled';
  const billed = (ticket.total_cents ?? 0) > 0;
  const placeName = ticket.place?.name ?? 'Partner place';
  const photo = ticket.place?.photos?.[0] ?? null;
  const category = ticket.place?.category ?? null;
  const storyOnTicket =
    ticket.story_status != null && ticket.story_status !== 'not_required';

  // THIS place's strategy → THIS place's rates (MESITA-869). 'zero' means the
  // rates are custom or cleared, so every percentage is suppressed rather
  // than quoted wrong.
  const strategy = strategyForPlaceRow(ticket.place);
  const priced = strategy !== 'zero';
  const rate = (key: 'story' | 'review') =>
    REWARD_SEGMENT_BY_KEY[key].rates[strategy];
  const pct = (v: number) => (priced && v > 0 ? `${v}%` : '—');
  // The ceiling across every rung this guest can reach here — the ONE number
  // the strip quotes. Never paired with its reason or the class (MESITA-860).
  const ceiling = peakRateForClass(classKey, strategy);
  const qrSize = Math.min(230, Dimensions.get('window').width * 0.62);

  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View className="overflow-hidden rounded-3xl border border-border bg-card">
          <View style={{ height: 128 }}>
            {photo ? (
              <Image
                source={{ uri: photo }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={PASS_GRADIENTS.standard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Store size={32} color="rgba(255,255,255,0.8)" />
              </LinearGradient>
            )}
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back to Rewards"
              className="absolute top-3 left-3 h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            >
              <ArrowLeft size={16} color="#fff" />
            </Pressable>
          </View>
          <View className="flex-row items-center justify-between px-4 py-3" style={{ gap: 12 }}>
            <View className="min-w-0 flex-1">
              <Text
                className="font-extrabold text-foreground"
                numberOfLines={1}
                style={{ fontSize: 16 }}
              >
                {placeName}
              </Text>
              {category ? (
                <Text
                  className="mt-0.5 capitalize text-muted-foreground"
                  numberOfLines={1}
                  style={{ fontSize: 11.5 }}
                >
                  {category.replaceAll('_', ' ')}
                </Text>
              ) : null}
            </View>
            <View
              className={`rounded-full px-2.5 py-1 ${
                saved
                  ? 'bg-emerald-500/10'
                  : cancelled
                    ? 'bg-muted'
                    : 'bg-primary/10'
              }`}
            >
              <Text
                className={`font-extrabold uppercase ${
                  saved
                    ? 'text-emerald-700'
                    : cancelled
                      ? 'text-muted-foreground'
                      : 'text-primary'
                }`}
                style={{ fontSize: 10, letterSpacing: 1 }}
              >
                {saved ? 'Completed' : cancelled ? 'Cancelled' : 'Live'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── The pass ── */}
        <View className="overflow-hidden rounded-3xl">
          <LinearGradient
            colors={PASS_GRADIENTS[classKey] ?? PASS_GRADIENTS.standard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 20 }}
          >
            <View className="flex-row items-center justify-between">
              <Text
                className="font-bold uppercase text-white/80"
                style={{ fontSize: 10, letterSpacing: 1.4 }}
              >
                Mesita Pass
              </Text>
              <View className="rounded-full bg-white/25 px-2.5 py-1">
                <Text
                  className="font-extrabold uppercase text-white"
                  style={{ fontSize: 10, letterSpacing: 1 }}
                >
                  {classProperLabel(classKey)}
                </Text>
              </View>
            </View>

            {closed ? (
              <View className="items-center py-8" style={{ gap: 8 }}>
                {saved ? (
                  <>
                    <PartyPopper size={32} color="#fff" />
                    <Text
                      className="text-center font-extrabold text-white"
                      style={{ fontSize: 16 }}
                    >
                      {ticket.discount_cents
                        ? `You saved ${formatCurrency(ticket.discount_cents)}`
                        : 'Visit complete'}
                    </Text>
                    <Text className="text-white/85" style={{ fontSize: 12 }}>
                      {ticket.discount_percent
                        ? `${ticket.discount_percent}% off at ${placeName}`
                        : placeName}
                    </Text>
                    {!billed ? (
                      <View
                        className="mt-3 w-full rounded-xl bg-white/20 p-3"
                        style={{ maxWidth: 260 }}
                      >
                        <Text
                          className="font-bold uppercase text-white/90"
                          style={{ fontSize: 11, letterSpacing: 1 }}
                        >
                          How much was the bill?
                        </Text>
                        <Text
                          className="mt-0.5 text-white/80"
                          style={{ fontSize: 10.5 }}
                        >
                          Optional — it records what you saved.
                        </Text>
                        <View
                          className="mt-2 flex-row items-center"
                          style={{ gap: 6 }}
                        >
                          <TextInput
                            inputMode="decimal"
                            placeholder="850"
                            placeholderTextColor="#a3a3a3"
                            value={totalDraft}
                            onChangeText={setTotalDraft}
                            className="h-9 flex-1 rounded-lg bg-white/90 px-2.5 font-semibold text-neutral-900"
                            style={{ fontSize: 13 }}
                          />
                          <Pressable
                            disabled={totalBusy}
                            onPress={() => void submitTotal()}
                            accessibilityRole="button"
                            accessibilityLabel="Save bill total"
                            className="h-9 w-9 items-center justify-center rounded-lg bg-white/90 active:scale-95"
                          >
                            {totalBusy ? (
                              <ActivityIndicator size="small" color="#171717" />
                            ) : (
                              <Check size={16} color="#171717" strokeWidth={3} />
                            )}
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Text
                      className="font-extrabold text-white"
                      style={{ fontSize: 16 }}
                    >
                      Ticket cancelled
                    </Text>
                    <Text className="text-white/85" style={{ fontSize: 12 }}>
                      Start a fresh one from Rewards whenever you&apos;re back.
                    </Text>
                  </>
                )}
              </View>
            ) : (
              <>
                {ticket.check_code ? (
                  <View
                    className="mt-4 self-center rounded-3xl bg-white"
                    style={{ padding: 14 }}
                  >
                    <QRCode
                      value={checkUrlForCode(ticket.check_code)}
                      size={qrSize}
                      color="#2b1233"
                      backgroundColor="#ffffff"
                    />
                  </View>
                ) : null}
                <View
                  accessibilityLiveRegion="polite"
                  className="mt-3 flex-row items-center justify-center"
                  style={{ gap: 6 }}
                >
                  {scanned && ticket.status === 'open' ? (
                    <>
                      <BadgeCheck size={14} color="#fff" />
                      <Text className="text-white/90" style={{ fontSize: 12 }}>
                        Verified by {placeName}
                      </Text>
                    </>
                  ) : (
                    <Text
                      className="text-center text-white/90"
                      style={{ fontSize: 12, maxWidth: 260 }}
                    >
                      {statusLine(ticket)}
                    </Text>
                  )}
                </View>
                {billed ? (
                  <View className="mt-4 items-center rounded-xl bg-white/20 p-3.5">
                    <Text
                      className="font-bold uppercase text-white/90"
                      style={{ fontSize: 10, letterSpacing: 1.4 }}
                    >
                      {ticket.discount_percent ?? 0}% off applied
                    </Text>
                    <Text
                      className="mt-0.5 font-extrabold text-white"
                      style={{ fontSize: 24 }}
                    >
                      {formatCurrency(
                        Math.max(
                          0,
                          (ticket.total_cents ?? 0) -
                            (ticket.discount_cents ?? 0),
                        ),
                      )}
                    </Text>
                    <Text className="mt-1 text-white/90" style={{ fontSize: 11 }}>
                      to pay at the table
                      {ticket.discount_cents
                        ? ` — you save ${formatCurrency(ticket.discount_cents)}`
                        : ''}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </LinearGradient>
        </View>

        {/* ── Tasks checklist ── */}
        {!cancelled ? (
          <View className="overflow-hidden rounded-2xl border border-border bg-card">
            <View className="flex-row items-baseline justify-between px-3.5 pt-3.5 pb-1.5">
              <Text className="font-bold text-foreground" style={{ fontSize: 13 }}>
                Your tasks
              </Text>
              <Text className="text-muted-foreground" style={{ fontSize: 10.5 }}>
                {priced ? 'Optional — each one pays' : 'Optional'}
              </Text>
            </View>
            <View className="px-2.5 pb-3" style={{ gap: 6 }}>
              {storyOnTicket ? (
                <TaskRow
                  Icon={Camera}
                  title="Post an Instagram story"
                  hint="Tag the place — then check it here"
                  reward={pct(rate('story'))}
                  state={
                    acting === 'story'
                      ? 'busy'
                      : taskStateFor(ticket.story_status)
                  }
                  onDo={live ? () => void runProof('story') : undefined}
                />
              ) : null}
              <TaskRow
                Icon={Star}
                title="Leave a Google review"
                hint="At the table, once per place"
                reward={pct(rate('review'))}
                state={
                  acting === 'review'
                    ? 'busy'
                    : taskStateFor(ticket.review_status)
                }
                onDo={live ? () => void runProof('review') : undefined}
              />
              <TaskRow
                Icon={UtensilsCrossed}
                title="Rate it on Mesita"
                hint="Food · service · ambiance — feeds its rating"
                reward="★"
                state={reviewDone ? 'done' : 'todo'}
                onDo={() => setReviewOpen(true)}
              />
            </View>
            {actionError ? (
              <Text
                className="mx-3.5 mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-destructive"
                style={{ fontSize: 12 }}
              >
                {actionError}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* ── Reward strip — the ceiling, never the reason (MESITA-860) ── */}
        {live ? (
          <View className="rounded-2xl border border-border bg-card px-3.5 py-3">
            {priced && ceiling > 0 ? (
              <>
                <Text
                  className="font-bold text-foreground"
                  style={{ fontSize: 13, lineHeight: 18 }}
                >
                  Up to {ceiling}% — Discount for You
                </Text>
                <Text
                  className="mt-1 text-muted-foreground"
                  style={{ fontSize: 11, lineHeight: 15 }}
                >
                  Depending on your eligible bonuses. You always keep your
                  single best reward — never added together.
                </Text>
              </>
            ) : (
              <Text
                className="text-muted-foreground"
                style={{ fontSize: 12, lineHeight: 16 }}
              >
                Your discount is set by the place and applied at the table.
              </Text>
            )}
          </View>
        ) : null}

        {ticket.status === 'open' ? (
          <Pressable
            onPress={() => void cancel()}
            disabled={cancelling}
            accessibilityRole="button"
            className="flex-row items-center justify-center"
            style={{ minHeight: 44, gap: 6 }}
          >
            {cancelling ? <ActivityIndicator size="small" /> : null}
            <Text
              className="font-semibold text-muted-foreground"
              style={{ fontSize: 12.5 }}
            >
              Cancel this ticket
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <FullScreenSheet
        visible={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title={`Rate ${placeName}`}
        subtitle="Feeds the place's Mesita rating"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <TicketReviewForm
            draft={reviewDraft}
            onChange={setReviewDraft}
            onSubmit={() => void submitMesitaReview()}
            busy={reviewBusy}
          />
        </ScrollView>
      </FullScreenSheet>
    </>
  );
}
