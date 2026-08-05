// THE TICKET (MESITA-857 · MESITA-908) — mobile mirror of web TicketScreen.
// Locked order: Place → Consumer → Reward → Tasks → QR (scannable) →
// Results (closed) → Report. Task sheets are FullScreenSheets on this route.

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Check,
  Flag,
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

import { DefaultAvatar } from '@/components/ui/DefaultAvatar';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import {
  GoogleReviewSheet,
  googleMapsSearchUrl,
} from '@/components/rewards/GoogleReviewSheet';
import { InstagramStorySheet } from '@/components/rewards/InstagramStorySheet';
import {
  TicketReviewForm,
  type TicketReviewDraft,
} from '@/components/rewards/TicketReviewForm';
import { COLORS } from '@/constants/brand';
import { formatCurrency, submitTicketReview } from '@/lib/api/pay';
import {
  ACTIVE_TICKET_STATUSES,
  REPORT_REASONS,
  apiCancelTicket,
  apiReportTicket,
  apiSubmitReview,
  apiSubmitStory,
  apiSubmitTicketTotal,
  checkUrlForCode,
  type ConsumerTicketRow,
  type ReportReason,
} from '@/lib/api/tickets';
import { classProperLabel } from '@/lib/consumer-classes';
import { strategyForPlaceRow } from '@/lib/promo-rates';
import {
  peakRateForClass,
  rateForSegment,
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

const CLASS_CHIP: Record<string, { bg: string; fg: string }> = {
  standard: { bg: '#ced9e5', fg: '#260409' },
  premium: { bg: '#2563eb', fg: '#ffffff' },
  influencer: { bg: '#dc2626', fg: '#ffffff' },
  aura: { bg: '#f5cc58', fg: '#ffffff' },
};

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
  const actionable = (state === 'todo' || state === 'rejected') && onDo;
  return (
    <Pressable
      onPress={onDo}
      disabled={!actionable}
      accessibilityRole="button"
      className={`flex-row items-center rounded-xl px-2.5 py-2 ${
        done ? 'bg-emerald-500/10' : state === 'checking' ? 'bg-muted/50' : 'bg-muted/40'
      }`}
      style={{ minHeight: 44, gap: 10 }}
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
          done ? 'border-emerald-500 bg-emerald-500' : 'border-border'
        }`}
      >
        {state === 'busy' || state === 'checking' ? (
          <ActivityIndicator size="small" color="#775254" />
        ) : done ? (
          <Check size={12} color="#fff" strokeWidth={3} />
        ) : null}
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Icon size={14} color={done ? '#047857' : '#260409'} />
          <Text
            className={`font-bold ${done ? 'text-emerald-800' : 'text-foreground'}`}
            numberOfLines={1}
            style={{ fontSize: 12.5 }}
          >
            {title}
          </Text>
        </View>
        <Text
          className="mt-0.5 text-muted-foreground"
          numberOfLines={1}
          style={{ fontSize: 10.5 }}
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
        style={{ fontSize: 14 }}
      >
        {reward}
      </Text>
    </Pressable>
  );
}

type TaskSheet = 'mesita' | 'google' | 'instagram' | 'report' | null;

export function TicketScreen({
  userId,
  ticketId,
}: {
  userId: string;
  ticketId: string;
}) {
  const router = useRouter();
  const tickets = useConsumerTickets(userId);
  const { consumerClass, profile } = useAuth();
  const classKey = (consumerClass?.class ?? 'standard') as RewardClassKey;

  const guestName = useMemo(() => {
    const first = profile?.first_name?.trim() ?? '';
    const last = profile?.last_name?.trim() ?? '';
    return (
      [first, last].filter(Boolean).join(' ') ||
      profile?.full_name?.trim() ||
      null
    );
  }, [profile]);

  const igHandle = profile?.instagram_handle ?? null;
  const avatarUrl = profile?.avatar_url ?? null;

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
    wasScannedRef.current = scanned;
  }, [scanned]);

  const [sheet, setSheet] = useState<TaskSheet>(null);

  const confirmGoogle = useCallback(async () => {
    await apiSubmitReview(ticketId);
    await tickets.refresh();
  }, [ticketId, tickets]);

  const confirmStory = useCallback(async () => {
    await apiSubmitStory(ticketId);
    await tickets.refresh();
  }, [ticketId, tickets]);

  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
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
    setReviewError(null);
    try {
      await submitTicketReview({ ticketId, ...reviewDraft });
      setReviewDone(true);
      setSheet(null);
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Couldn't save your review.",
      );
    } finally {
      setReviewBusy(false);
    }
  }, [ticketId, reviewDraft]);

  const [totalDraft, setTotalDraft] = useState('');
  const [totalBusy, setTotalBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
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

  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const submitReport = useCallback(async () => {
    if (!reportReason) return;
    setReportBusy(true);
    setReportError(null);
    try {
      await apiReportTicket(ticketId, reportReason, reportDetails);
      setReported(true);
      setSheet(null);
    } catch (err) {
      setReportError(
        err instanceof Error ? err.message : "Couldn't send that just yet.",
      );
    } finally {
      setReportBusy(false);
    }
  }, [ticketId, reportReason, reportDetails]);

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

  const strategy = strategyForPlaceRow(ticket.place);
  const priced = strategy !== 'zero';
  const rate = (key: 'story' | 'review') =>
    rateForSegment(key, classKey, strategy);
  const pct = (v: number) => (priced && v > 0 ? `${v}%` : '—');
  const ceiling = peakRateForClass(classKey, strategy);
  const firstVisit = !billed && ticket.first_scanned_at == null;
  const firstVisitHint = firstVisit
    ? 'Unlocks your Welcome Bonus — the biggest one'
    : 'At the table, once per place';
  const qrSize = Math.min(170, Dimensions.get('window').width * 0.48);

  const scannable =
    live &&
    Boolean(ticket.check_code) &&
    (ticket.status === 'open' || ticket.status === 'awaiting_payment_confirm');

  const showIgHandle =
    (classKey === 'influencer' || storyOnTicket) && Boolean(igHandle);
  const mapsUrl = googleMapsSearchUrl(placeName, ticket.place?.address);
  const chip = CLASS_CHIP[classKey] ?? CLASS_CHIP.standard;

  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 14, paddingBottom: 24, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1 · Place */}
        <View
          className="flex-row items-center rounded-[18px] border border-border bg-card"
          style={{ gap: 10, paddingVertical: 8, paddingLeft: 8, paddingRight: 12 }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back to Rewards"
            className="h-8 w-8 items-center justify-center rounded-full bg-muted active:scale-95"
          >
            <ArrowLeft size={14} color="#260409" />
          </Pressable>
          <View className="h-10 w-10 overflow-hidden rounded-xl">
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
                <Store size={16} color="rgba(255,255,255,0.8)" />
              </LinearGradient>
            )}
          </View>
          <View className="min-w-0 flex-1">
            <Text
              className="font-extrabold text-foreground"
              numberOfLines={1}
              style={{ fontSize: 14 }}
            >
              {placeName}
            </Text>
            {category ? (
              <Text
                className="mt-0.5 capitalize text-muted-foreground"
                numberOfLines={1}
                style={{ fontSize: 10.5 }}
              >
                {category.replaceAll('_', ' ')}
              </Text>
            ) : null}
          </View>
          <View
            className={`rounded-full px-2 py-0.5 ${
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
              style={{ fontSize: 9, letterSpacing: 1 }}
            >
              {saved ? 'Completed' : cancelled ? 'Cancelled' : 'Live'}
            </Text>
          </View>
        </View>

        {/* 2 · Consumer */}
        <View
          className="flex-row items-center rounded-[18px] border border-border bg-card px-3"
          style={{ gap: 10, paddingVertical: 8 }}
        >
          <View className="h-9 w-9 overflow-hidden rounded-full">
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: 36, height: 36 }}
                contentFit="cover"
              />
            ) : (
              <DefaultAvatar size={36} />
            )}
          </View>
          <View className="min-w-0 flex-1">
            <Text
              className="font-bold text-foreground"
              numberOfLines={1}
              style={{ fontSize: 13 }}
            >
              {guestName ?? 'Mesita guest'}
            </Text>
            {showIgHandle ? (
              <Text
                className="mt-0.5 text-muted-foreground"
                numberOfLines={1}
                style={{ fontSize: 10.5 }}
              >
                @{igHandle!.replace(/^@/, '')}
              </Text>
            ) : null}
          </View>
          <View
            className="rounded-full px-2 py-0.5"
            style={{ backgroundColor: chip.bg }}
          >
            <Text
              className="font-extrabold uppercase"
              style={{ fontSize: 9, letterSpacing: 1, color: chip.fg }}
            >
              {classProperLabel(classKey)}
            </Text>
          </View>
        </View>

        {/* 3 · Reward */}
        <View className="rounded-[18px] border border-border bg-card px-3 py-2">
          {cancelled ? (
            <Text className="text-muted-foreground" style={{ fontSize: 12 }}>
              No reward on this visit — the ticket was cancelled.
            </Text>
          ) : live && billed ? (
            <Text style={{ fontSize: 12, lineHeight: 16 }}>
              <Text className="font-bold text-foreground">
                {ticket.discount_percent ?? 0}% off applied
              </Text>
              <Text className="text-muted-foreground">
                {' '}
                — amount to pay shows under the QR.
              </Text>
            </Text>
          ) : closed ? (
            <Text className="text-muted-foreground" style={{ fontSize: 12 }}>
              Visit closed — applied rate lives in Results below.
            </Text>
          ) : priced && ceiling > 0 ? (
            <Text style={{ fontSize: 12, lineHeight: 16 }}>
              <Text className="font-bold text-foreground">
                Up to {ceiling}% — Discount for You.
              </Text>{' '}
              <Text className="text-muted-foreground">
                You always keep your single best reward — never added together.
              </Text>
            </Text>
          ) : (
            <Text className="text-muted-foreground" style={{ fontSize: 12 }}>
              Your discount is set by the place and applied at the table.
            </Text>
          )}
        </View>

        {/* 4 · Tasks */}
        {!cancelled ? (
          <View className="overflow-hidden rounded-2xl border border-border bg-card">
            <View className="flex-row items-baseline justify-between px-3 pt-2.5 pb-1">
              <Text className="font-bold text-foreground" style={{ fontSize: 12.5 }}>
                Your tasks
              </Text>
              <Text className="text-muted-foreground" style={{ fontSize: 10 }}>
                {priced ? 'Optional — each one pays' : 'Optional'}
              </Text>
            </View>
            <View className="px-2 pb-2" style={{ gap: 2 }}>
              {storyOnTicket ? (
                <TaskRow
                  Icon={Camera}
                  title="Post an Instagram story"
                  hint="Tag the place — then confirm here"
                  reward={pct(rate('story'))}
                  state={taskStateFor(ticket.story_status)}
                  onDo={
                    live
                      ? () => {
                          const st = taskStateFor(ticket.story_status);
                          if (st === 'todo' || st === 'rejected')
                            setSheet('instagram');
                        }
                      : undefined
                  }
                />
              ) : null}
              <TaskRow
                Icon={Star}
                title="Leave a Google review"
                hint={firstVisitHint}
                reward={pct(rate('review'))}
                state={taskStateFor(ticket.review_status)}
                onDo={
                  live
                    ? () => {
                        const st = taskStateFor(ticket.review_status);
                        if (st === 'todo' || st === 'rejected')
                          setSheet('google');
                      }
                    : undefined
                }
              />
              <TaskRow
                Icon={UtensilsCrossed}
                title="Rate it on Mesita"
                hint="Food · service · ambiance — feeds its rating"
                reward="★"
                state={reviewDone ? 'done' : 'todo'}
                onDo={
                  reviewDone
                    ? undefined
                    : () => {
                        setReviewError(null);
                        setSheet('mesita');
                      }
                }
              />
            </View>
            {actionError ? (
              <Text
                className="mx-3 mb-2.5 rounded-lg bg-destructive/10 px-3 py-2 text-destructive"
                style={{ fontSize: 12 }}
              >
                {actionError}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* 5 · QR scannable only */}
        {scannable ? (
          <View className="overflow-hidden rounded-3xl">
            <LinearGradient
              colors={PASS_GRADIENTS[classKey] ?? PASS_GRADIENTS.standard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ paddingHorizontal: 16, paddingVertical: 14 }}
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className="font-bold uppercase text-white/80"
                  style={{ fontSize: 9, letterSpacing: 1.4 }}
                >
                  Show to waiter
                </Text>
                <View className="rounded-full bg-white/25 px-2 py-0.5">
                  <Text
                    className="font-extrabold uppercase text-white"
                    style={{ fontSize: 9, letterSpacing: 1 }}
                  >
                    QR
                  </Text>
                </View>
              </View>
              <View
                className="mt-2.5 self-center rounded-2xl bg-white"
                style={{ padding: 10 }}
              >
                <QRCode
                  value={checkUrlForCode(ticket.check_code!)}
                  size={qrSize}
                  color="#2b1233"
                  backgroundColor="#ffffff"
                />
              </View>
              <View
                accessibilityLiveRegion="polite"
                className="mt-2 flex-row items-center justify-center"
                style={{ gap: 6 }}
              >
                {scanned && ticket.status === 'open' ? (
                  <>
                    <BadgeCheck size={14} color="#fff" />
                    <Text className="text-white/90" style={{ fontSize: 11 }}>
                      Verified by {placeName}
                    </Text>
                  </>
                ) : (
                  <Text
                    className="text-center text-white/90"
                    style={{ fontSize: 11, maxWidth: 260 }}
                  >
                    {statusLine(ticket)}
                  </Text>
                )}
              </View>
              {billed ? (
                <View
                  className="mt-2.5 items-center rounded-xl bg-white/20"
                  style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                >
                  <Text
                    className="font-bold uppercase text-white/90"
                    style={{ fontSize: 9, letterSpacing: 1.4 }}
                  >
                    {ticket.discount_percent ?? 0}% off applied
                  </Text>
                  <Text
                    className="mt-0.5 font-extrabold text-white"
                    style={{ fontSize: 20 }}
                  >
                    {formatCurrency(
                      Math.max(
                        0,
                        (ticket.total_cents ?? 0) - (ticket.discount_cents ?? 0),
                      ),
                    )}
                  </Text>
                  <Text className="mt-0.5 text-white/90" style={{ fontSize: 10.5 }}>
                    to pay at the table
                    {ticket.discount_cents
                      ? ` — you save ${formatCurrency(ticket.discount_cents)}`
                      : ''}
                  </Text>
                </View>
              ) : null}
            </LinearGradient>
          </View>
        ) : null}

        {/* 6 · Results closed only */}
        {closed ? (
          <View className="overflow-hidden rounded-3xl">
            <LinearGradient
              colors={PASS_GRADIENTS[classKey] ?? PASS_GRADIENTS.standard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ paddingHorizontal: 16, paddingVertical: 14 }}
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className="font-bold uppercase text-white/80"
                  style={{ fontSize: 9, letterSpacing: 1.4 }}
                >
                  Mesita Pass
                </Text>
                <View className="rounded-full bg-white/25 px-2 py-0.5">
                  <Text
                    className="font-extrabold uppercase text-white"
                    style={{ fontSize: 9, letterSpacing: 1 }}
                  >
                    {classProperLabel(classKey)}
                  </Text>
                </View>
              </View>
              <View className="items-center py-5" style={{ gap: 6 }}>
                {saved ? (
                  <>
                    <PartyPopper size={28} color="#fff" />
                    <Text
                      className="text-center font-extrabold text-white"
                      style={{ fontSize: 15 }}
                    >
                      {ticket.discount_cents
                        ? `You saved ${formatCurrency(ticket.discount_cents)}`
                        : 'Visit complete'}
                    </Text>
                    <Text className="text-white/85" style={{ fontSize: 11.5 }}>
                      {ticket.discount_percent
                        ? `${ticket.discount_percent}% off at ${placeName}`
                        : placeName}
                    </Text>
                    {!billed ? (
                      <View
                        className="mt-2.5 w-full rounded-xl bg-white/20 p-2.5"
                        style={{ maxWidth: 260 }}
                      >
                        <Text
                          className="font-bold uppercase text-white/90"
                          style={{ fontSize: 10, letterSpacing: 1 }}
                        >
                          How much was the bill?
                        </Text>
                        <Text
                          className="mt-0.5 text-white/80"
                          style={{ fontSize: 10 }}
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
                      style={{ fontSize: 15 }}
                    >
                      Ticket cancelled
                    </Text>
                    <Text className="text-white/85" style={{ fontSize: 11.5 }}>
                      Start a fresh one from Rewards whenever you&apos;re back.
                    </Text>
                  </>
                )}
              </View>
            </LinearGradient>
          </View>
        ) : null}

        {/* 7 · Report */}
        {ticket.status === 'open' ? (
          <Pressable
            onPress={() => void cancel()}
            disabled={cancelling}
            accessibilityRole="button"
            className="flex-row items-center justify-center"
            style={{ minHeight: 36, gap: 6 }}
          >
            {cancelling ? <ActivityIndicator size="small" /> : null}
            <Text
              className="font-semibold text-muted-foreground"
              style={{ fontSize: 12 }}
            >
              Cancel this ticket
            </Text>
          </Pressable>
        ) : null}

        {!cancelled ? (
          reported ? (
            <View
              className="flex-row items-center self-center rounded-full border border-border bg-muted/40 px-4"
              style={{ minHeight: 40, gap: 8 }}
            >
              <Flag size={14} color={COLORS.mutedForeground} />
              <Text
                className="font-semibold text-muted-foreground"
                style={{ fontSize: 12 }}
              >
                Reported — Mesita is looking at it
              </Text>
            </View>
          ) : (
            <View className="items-center" style={{ gap: 6 }}>
              <Pressable
                onPress={() => setSheet('report')}
                accessibilityRole="button"
                className="flex-row items-center rounded-full border border-border bg-card px-4 active:scale-[0.99]"
                style={{ minHeight: 40, gap: 8 }}
              >
                <Flag size={14} color={COLORS.destructive} />
                <Text
                  className="font-bold text-foreground"
                  style={{ fontSize: 12.5 }}
                >
                  Report a problem
                </Text>
              </Pressable>
              <Text
                className="text-center text-muted-foreground"
                style={{ fontSize: 10, lineHeight: 14, maxWidth: 272 }}
              >
                Discount not honored, wrong total, anything off — a real person
                at Mesita reads it.
              </Text>
            </View>
          )
        ) : null}
      </ScrollView>

      <FullScreenSheet
        visible={sheet === 'mesita'}
        onClose={() => setSheet(null)}
        title={`Rate ${placeName}`}
        subtitle="On Mesita · feeds its rating"
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
            error={reviewError}
          />
        </ScrollView>
      </FullScreenSheet>

      <GoogleReviewSheet
        open={sheet === 'google'}
        onClose={() => setSheet(null)}
        placeName={placeName}
        mapsUrl={mapsUrl}
        onConfirm={confirmGoogle}
      />

      <InstagramStorySheet
        open={sheet === 'instagram'}
        onClose={() => setSheet(null)}
        placeName={placeName}
        onConfirm={confirmStory}
      />

      <FullScreenSheet
        visible={sheet === 'report'}
        onClose={() => setSheet(null)}
        title={`What went wrong at ${placeName}?`}
        subtitle="A real person at Mesita reads every report"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: 6 }}>
            {REPORT_REASONS.map((r) => {
              const active = reportReason === r.key;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => setReportReason(r.key)}
                  accessibilityRole="button"
                  className={`rounded-2xl px-3.5 py-3 ${
                    active ? 'bg-primary/10' : 'bg-muted/40'
                  }`}
                  style={
                    active
                      ? { borderWidth: 2, borderColor: '#fb2b7b' }
                      : { borderWidth: 2, borderColor: 'transparent' }
                  }
                >
                  <Text
                    className="font-bold text-foreground"
                    style={{ fontSize: 13.5 }}
                  >
                    {r.label}
                  </Text>
                  <Text
                    className="mt-0.5 text-muted-foreground"
                    style={{ fontSize: 11.5 }}
                  >
                    {r.hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={reportDetails}
            onChangeText={(t) => setReportDetails(t.slice(0, 1000))}
            placeholder="Anything else we should know? (optional)"
            placeholderTextColor="#a3a3a3"
            multiline
            numberOfLines={3}
            className="rounded-2xl border border-border bg-card px-3.5 py-3 text-foreground"
            style={{ fontSize: 13, minHeight: 84, textAlignVertical: 'top' }}
          />

          {reportError ? (
            <Text
              className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive"
              style={{ fontSize: 12 }}
            >
              {reportError}
            </Text>
          ) : null}

          <Pressable
            disabled={!reportReason || reportBusy}
            onPress={() => void submitReport()}
            accessibilityRole="button"
            className="overflow-hidden rounded-2xl active:opacity-90"
            style={{ opacity: !reportReason || reportBusy ? 0.5 : 1 }}
          >
            <LinearGradient
              colors={PASS_GRADIENTS.standard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              }}
            >
              {reportBusy ? <ActivityIndicator size="small" color="#fff" /> : null}
              <Text className="font-bold text-white" style={{ fontSize: 14 }}>
                Send report
              </Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </FullScreenSheet>
    </>
  );
}
