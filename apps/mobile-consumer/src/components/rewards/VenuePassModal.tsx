// The venue pass (Wallet v3, MESITA-811) — mobile mirror: tap a place in New
// and this modal IS your Mesita pass for that venue — class-tinted card, the
// ticket QR, live status. Reuses the venue's open ticket when one exists,
// otherwise creates on open; Influencers get one interstitial tap (the Story
// opt-in is create-time only). NO member code (MESITA-820): check-web-get-ticket
// resolves ONLY the per-ticket check_code, and _shared/ticket-check.ts forbids
// consumers.code from ever reaching the staff page.
//
// The pass answers WHERE (place + zone/category), WHO (name, class, @handle —
// staff match the face BEFORE scanning) and WHAT (the opportunity board).
// The board is a BOARD, not a picker: the engine is best-of, so doing two
// things keeps the higher one automatically; "choose one" would imply picking
// review forfeits welcome, which is false (MESITA-821).

import {
  AtSign,
  BadgeCheck,
  Camera,
  Check,
  Crown,
  DoorOpen,
  Megaphone,
  PartyPopper,
  Sparkles,
  Star,
  User,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { formatCurrency } from '@/lib/api/pay';
import type { Place } from '@/lib/api/places';
import {
  ACTIVE_TICKET_STATUSES,
  apiCancelTicket,
  apiCreateTicket,
  apiListConsumerTickets,
  apiSubmitReview,
  apiSubmitStory,
  checkUrlForCode,
  type ConsumerTicketRow,
} from '@/lib/api/tickets';
import { classProperLabel } from '@/lib/consumer-classes';
import {
  PEAK_STRATEGY,
  reachableSegments,
  segmentKeyForClass,
  type RewardSegmentKey,
} from '@/lib/reward-segments';
import { EFError } from '@/lib/ef';
import type { ConsumerTicketsState } from '@/lib/hooks/useConsumerTickets';
import { useAuth } from '@/providers/auth';
import { firstInitials, formatCompactCount } from '@/lib/utils';

// Class-tinted pass gradients — ported from the retired passport card (#548).
const PASS_GRADIENTS: Record<string, [string, string, string]> = {
  standard: ['#ff7a45', '#ff4d6d', '#ff2d78'],
  premium: ['#ff7a45', '#ff3d73', '#a13cf0'],
  influencer: ['#ff7a45', '#4aa8ff', '#2f7fd6'],
  aura: ['#ff7a45', '#ffb03d', '#e0982e'],
};

const SEGMENT_ICON: Record<RewardSegmentKey, typeof User> = {
  standard: User,
  premium: Crown,
  influencer: Megaphone,
  aura: Sparkles,
  story: Camera,
  welcome: DoorOpen,
  review: Star,
};

// HOW you land on each rung, in the guest's words.
const SEGMENT_HOW: Record<RewardSegmentKey, string> = {
  standard: 'Always on',
  premium: 'Always on',
  influencer: 'Always on',
  aura: 'Always on',
  story: 'Post a story tagging the place',
  welcome: 'Automatic on your first visit here',
  review: 'Leave a Google review at the table',
};

const STORY_LINE: Record<string, string> = {
  pending: 'Bill is in. Post your tagged story so the place can approve it.',
  submitted: 'Story sent — the place is checking it.',
  ai_rejected: "Story wasn't accepted — ask the staff to review it.",
  staff_rejected: "Story wasn't accepted — ask the staff to review it.",
};

function statusLine(t: ConsumerTicketRow): string {
  switch (t.status) {
    case 'open':
      return 'Show this QR — staff scan it to verify and start your visit.';
    case 'awaiting_story':
      return STORY_LINE[t.story_status ?? ''] ?? STORY_LINE.pending;
    case 'awaiting_payment_confirm':
      return 'All set — pay the discounted total at the table.';
    default:
      return t.status;
  }
}

export function VenuePassModal({
  place,
  tickets,
  onClose,
  onTicketStarted,
}: {
  /** The venue this pass is for; null = closed. Parent remounts per place. */
  place: Place | null;
  tickets: ConsumerTicketsState;
  onClose: () => void;
  /** Fired once a live ticket exists, so the page can land on Pending. */
  onTicketStarted: () => void;
}) {
  const { consumerClass, profile } = useAuth();
  const classKey = consumerClass?.class ?? 'standard';
  const isInfluencer = classKey === 'influencer';

  // Adopt the venue's open ticket at mount (remount-per-place keys this).
  const [ticketId, setTicketId] = useState<string | null>(() =>
    place
      ? (tickets.active.find((t) => t.project_id === place.id)?.id ?? null)
      : null,
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wantsStory, setWantsStory] = useState(false);
  // Snapshot from the create response so the QR renders before refresh lands.
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const ticket = useMemo(() => {
    if (!ticketId) return null;
    return (
      tickets.active.find((t) => t.id === ticketId) ??
      tickets.history.find((t) => t.id === ticketId) ??
      null
    );
  }, [ticketId, tickets.active, tickets.history]);

  const create = useCallback(
    async (withStory: boolean) => {
      if (!place) return;
      setCreating(true);
      setError(null);
      try {
        const res = await apiCreateTicket(place.id, withStory);
        setTicketId(res.ticket.id);
        setCreatedCode(res.ticket.check_code);
        onTicketStarted();
        void tickets.refresh();
      } catch (err) {
        if (err instanceof EFError && err.code === 'already_open') {
          // Race with another device/tab — adopt the existing ticket. The
          // friendly 409 carries its id; the unique-index race arm doesn't,
          // so fall back to a fresh list (never the stale closure state).
          const fromBody = err.body?.ticketId;
          let existingId = typeof fromBody === 'string' ? fromBody : null;
          if (!existingId) {
            try {
              const rows = await apiListConsumerTickets();
              existingId =
                rows.find(
                  (t) =>
                    t.project_id === place.id &&
                    ACTIVE_TICKET_STATUSES.has(t.status),
                )?.id ?? null;
            } catch {
              // fall through to the error box
            }
          }
          if (existingId) {
            setTicketId(existingId);
            onTicketStarted();
            void tickets.refresh();
            setCreating(false);
            return;
          }
        }
        setError(
          err instanceof Error ? err.message : "Couldn't start your ticket.",
        );
      } finally {
        setCreating(false);
      }
    },
    [place, tickets, onTicketStarted],
  );

  // Auto-create on open for everyone but Influencers (their Story choice is
  // create-time only). One shot — the ref survives error → Retry is manual.
  const bootRef = useRef(false);
  useEffect(() => {
    if (!place || ticketId || isInfluencer || bootRef.current) return;
    bootRef.current = true;
    void create(false);
  }, [place, ticketId, isInfluencer, create]);

  // Guest actions on a live ticket (MESITA-824). Real EFs — only the
  // screenshot is a placeholder — so the ticket genuinely reaches
  // `submitted` and staff can approve it on the check page.
  const [acting, setActing] = useState<'story' | 'review' | null>(null);
  const runAction = useCallback(
    async (kind: 'story' | 'review') => {
      if (!ticketId) return;
      setActing(kind);
      setError(null);
      try {
        if (kind === 'story') await apiSubmitStory(ticketId);
        else await apiSubmitReview(ticketId);
        await tickets.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn't send that just yet.",
        );
      } finally {
        setActing(null);
      }
    },
    [ticketId, tickets],
  );

  const [cancelling, setCancelling] = useState(false);
  const cancel = useCallback(async () => {
    if (!ticketId) return;
    setCancelling(true);
    try {
      await apiCancelTicket(ticketId);
      await tickets.refresh();
      onClose();
    } catch {
      setCancelling(false);
    }
  }, [ticketId, tickets, onClose]);


  // Identity for the staff eyeball-check — unlike web this costs no extra
  // request since `profile` is already in auth context.
  const identityName =
    ([profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
      profile?.full_name ||
      '').trim() || `${classProperLabel(classKey)} member`;
  const identityHandle = profile?.instagram_handle ?? null;
  const followers = consumerClass?.followers ?? 0;

  const rungs = useMemo(() => reachableSegments(classKey), [classKey]);

  // Which proofs the guest can send RIGHT NOW.
  const actionable = useMemo(() => {
    if (!ticket || !ACTIVE_TICKET_STATUSES.has(ticket.status)) return [];
    const settled = (v: string | null | undefined) =>
      v != null && v !== 'not_required' && v !== 'pending';
    const out: {
      kind: 'story' | 'review';
      label: string;
      Icon: typeof Star;
      done: boolean;
    }[] = [];
    if (ticket.story_status != null && ticket.story_status !== 'not_required') {
      out.push({
        kind: 'story',
        label: settled(ticket.story_status) ? 'Story sent' : 'I posted my story',
        Icon: Camera,
        done: settled(ticket.story_status),
      });
    }
    out.push({
      kind: 'review',
      label: settled(ticket.review_status)
        ? 'Google review sent'
        : 'I left a Google review',
      Icon: Star,
      done: settled(ticket.review_status),
    });
    return out;
  }, [ticket]);
  const mineKey = segmentKeyForClass(classKey);

  const placeName = place?.name ?? 'the place';
  const placeSub =
    [place?.zone, place?.category_label ?? place?.category]
      .filter(Boolean)
      .join(' · ') || 'Mesita partner';
  const live = ticket ? ACTIVE_TICKET_STATUSES.has(ticket.status) : false;
  const scanned = ticket?.first_scanned_at != null;
  const billed = (ticket?.total_cents ?? 0) > 0;
  const qrCode = ticket?.check_code ?? createdCode;
  const qrSize = Math.min(220, Dimensions.get('window').width * 0.6);

  return (
    <FullScreenSheet
      visible={place !== null}
      onClose={onClose}
      title={placeName}
      subtitle="Your Mesita pass for this venue"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* The pass card */}
        <View className="overflow-hidden rounded-3xl">
          <LinearGradient
            colors={PASS_GRADIENTS[classKey] ?? PASS_GRADIENTS.standard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 20 }}
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text
                  className="font-bold uppercase text-white/80"
                  style={{ fontSize: 10, letterSpacing: 1.4 }}
                >
                  Mesita Pass
                </Text>
                <Text
                  className="mt-0.5 font-extrabold text-white"
                  numberOfLines={1}
                  style={{ fontSize: 17 }}
                >
                  {placeName}
                </Text>
                <Text
                  className="mt-0.5 text-white/80"
                  numberOfLines={1}
                  style={{ fontSize: 11.5 }}
                >
                  {placeSub}
                </Text>
              </View>
              <View className="rounded-full bg-white/25 px-2.5 py-1">
                <Text
                  className="font-extrabold uppercase text-white"
                  style={{ fontSize: 10, letterSpacing: 1 }}
                >
                  {classProperLabel(classKey)}
                </Text>
              </View>
            </View>

            {ticket && !live ? (
              ticket.status === 'revealed' ? (
                <View className="items-center gap-2 py-6">
                  <PartyPopper size={32} color="#fff" />
                  <Text
                    className="text-center font-extrabold text-white"
                    style={{ fontSize: 15 }}
                  >
                    Visit complete
                    {ticket.discount_cents
                      ? ` — you saved ${formatCurrency(ticket.discount_cents)}`
                      : ''}
                  </Text>
                  <Text className="text-white/85" style={{ fontSize: 12 }}>
                    It&apos;s in your History now.
                  </Text>
                </View>
              ) : (
                <View className="items-center gap-2 py-6">
                  <Text
                    className="font-extrabold text-white"
                    style={{ fontSize: 15 }}
                  >
                    Ticket closed
                  </Text>
                  <Text className="text-white/85" style={{ fontSize: 12 }}>
                    Start a fresh one from New whenever you&apos;re back.
                  </Text>
                </View>
              )
            ) : qrCode ? (
              <>
                <View
                  className="mt-4 self-center rounded-3xl bg-white"
                  style={{ padding: 14 }}
                >
                  <QRCode
                    value={checkUrlForCode(qrCode)}
                    size={qrSize}
                    color="#2b1233"
                    backgroundColor="#ffffff"
                  />
                </View>
                <View
                  accessibilityLiveRegion="polite"
                  className="mt-3 flex-row items-center justify-center gap-1.5"
                >
                  {scanned ? (
                    <>
                      <BadgeCheck size={14} color="#fff" />
                      <Text
                        className="text-center text-white/90"
                        style={{ fontSize: 12 }}
                      >
                        Verified by {placeName}
                      </Text>
                    </>
                  ) : (
                    <Text
                      className="text-center text-white/90"
                      style={{ fontSize: 12, maxWidth: 260 }}
                    >
                      {ticket
                        ? statusLine(ticket)
                        : 'Show this QR — staff scan it to verify and start your visit.'}
                    </Text>
                  )}
                </View>
                {billed && ticket ? (
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
            ) : creating ? (
              <View className="items-center gap-3 py-10">
                <ActivityIndicator color="#fff" />
                <Text className="text-white/85" style={{ fontSize: 12 }}>
                  Getting your QR for {placeName}…
                </Text>
              </View>
            ) : error ? (
              <View className="items-center gap-3 px-2 py-8">
                <Text
                  className="text-center text-white"
                  style={{ fontSize: 12.5 }}
                >
                  {error}
                </Text>
                <Pressable
                  onPress={() => void create(wantsStory)}
                  accessibilityRole="button"
                  className="rounded-xl bg-white/25 px-4 py-2 active:opacity-90"
                >
                  <Text className="font-bold text-white" style={{ fontSize: 12.5 }}>
                    Try again
                  </Text>
                </Pressable>
              </View>
            ) : isInfluencer ? (
              // Influencer interstitial — the one create-time choice.
              <View className="mt-4 gap-3">
                <Pressable
                  onPress={() => setWantsStory((v) => !v)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: wantsStory }}
                  className={`flex-row items-start gap-3 rounded-2xl border border-white/25 px-3.5 py-3 ${
                    wantsStory ? 'bg-white/25' : 'bg-white/10'
                  }`}
                >
                  <View className="h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                    <Camera size={16} color="#fff" />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text
                      className="font-bold text-white"
                      style={{ fontSize: 13 }}
                    >
                      Add the Story bonus — yours alone
                    </Text>
                    <Text
                      className="text-white/85"
                      style={{ fontSize: 11.5, lineHeight: 15 }}
                    >
                      Post a tagged story at the table for a bigger reward.
                    </Text>
                  </View>
                  <View
                    className={`mt-0.5 h-5 w-5 items-center justify-center rounded-full border border-white/60 ${
                      wantsStory ? 'bg-white' : ''
                    }`}
                  >
                    {wantsStory ? <Check size={12} color="#ff2d78" /> : null}
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => void create(wantsStory)}
                  accessibilityRole="button"
                  className="flex-row items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 active:opacity-90"
                >
                  <Sparkles size={16} color="#ff2d78" />
                  <Text
                    className="font-bold"
                    style={{ fontSize: 14, color: '#ff2d78' }}
                  >
                    Get my QR
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {/* WHO — staff match the face to the pass BEFORE scanning. */}
            {qrCode ? (
              <View
                className="mt-4 flex-row items-center border-t border-white/20 pt-3.5"
                style={{ gap: 10 }}
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-white/20">
                  <Text
                    className="font-extrabold text-white"
                    style={{ fontSize: 12 }}
                  >
                    {firstInitials(identityName)}
                  </Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text
                    className="font-extrabold text-white"
                    numberOfLines={1}
                    style={{ fontSize: 13.5 }}
                  >
                    {identityName}
                  </Text>
                  <View
                    className="mt-0.5 flex-row items-center"
                    style={{ gap: 8 }}
                  >
                    {identityHandle ? (
                      <View className="flex-row items-center" style={{ gap: 3 }}>
                        <AtSign size={11} color="rgba(255,255,255,0.85)" />
                        <Text
                          className="text-white/85"
                          numberOfLines={1}
                          style={{ fontSize: 11 }}
                        >
                          {identityHandle}
                        </Text>
                      </View>
                    ) : null}
                    {followers > 0 ? (
                      <View className="flex-row items-center" style={{ gap: 3 }}>
                        <Users size={11} color="rgba(255,255,255,0.85)" />
                        <Text className="text-white/85" style={{ fontSize: 11 }}>
                          {formatCompactCount(followers)}
                        </Text>
                      </View>
                    ) : null}
                    {!identityHandle && followers === 0 ? (
                      <Text className="text-white/85" style={{ fontSize: 11 }}>
                        {classProperLabel(classKey)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            ) : null}
          </LinearGradient>
        </View>

        {/* WHAT — the opportunity board (best-of, never a picker). */}
        {live || !ticket ? (
          <View className="overflow-hidden rounded-2xl border border-border bg-card">
            <View className="flex-row items-baseline justify-between px-3.5 pt-3.5 pb-1">
              <Text
                className="font-bold text-foreground"
                style={{ fontSize: 13 }}
              >
                What you can earn here
              </Text>
              <Text className="text-muted-foreground" style={{ fontSize: 10.5 }}>
                Best one wins
              </Text>
            </View>
            <View className="px-2.5 pt-1.5 pb-3" style={{ gap: 6 }}>
              {rungs.map((seg) => {
                const Icon = SEGMENT_ICON[seg.key];
                const mine = seg.key === mineKey;
                return (
                  <View
                    key={seg.key}
                    className={`flex-row items-center rounded-xl px-2.5 py-2 ${
                      mine ? 'bg-primary/10' : 'bg-muted/50'
                    }`}
                    style={{ gap: 10 }}
                  >
                    <View
                      className={`h-8 w-8 items-center justify-center rounded-lg ${
                        mine ? 'bg-primary/10' : 'bg-secondary/10'
                      }`}
                    >
                      <Icon size={16} color="#cf0360" />
                    </View>
                    <View className="min-w-0 flex-1">
                      <View className="flex-row items-center" style={{ gap: 6 }}>
                        <Text
                          className="font-bold text-foreground"
                          numberOfLines={1}
                          style={{ fontSize: 12.5, flexShrink: 1 }}
                        >
                          {seg.name}
                        </Text>
                        {mine ? (
                          <View className="rounded-full bg-primary/10 px-1.5 py-0.5">
                            <Text
                              className="font-extrabold uppercase text-primary"
                              style={{ fontSize: 8.5, letterSpacing: 1 }}
                            >
                              You
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text
                        className="mt-0.5 text-muted-foreground"
                        numberOfLines={1}
                        style={{ fontSize: 11 }}
                      >
                        {SEGMENT_HOW[seg.key]}
                      </Text>
                    </View>
                    <Text
                      className="font-extrabold text-foreground"
                      style={{ fontSize: 15 }}
                    >
                      {seg.rates[PEAK_STRATEGY]}%
                    </Text>
                  </View>
                );
              })}
              {actionable.map((a) => (
                <Pressable
                  key={`act-${a.kind}`}
                  onPress={() => void runAction(a.kind)}
                  disabled={acting !== null || a.done}
                  accessibilityRole="button"
                  className={`flex-row items-center justify-center rounded-xl px-3 ${
                    a.done ? 'bg-emerald-500/10' : 'bg-secondary/10'
                  }`}
                  style={{ minHeight: 44, gap: 8, opacity: acting ? 0.6 : 1 }}
                >
                  {acting === a.kind ? (
                    <ActivityIndicator size="small" />
                  ) : a.done ? (
                    <BadgeCheck size={16} color="#059669" />
                  ) : (
                    <a.Icon size={16} color="#cf0360" />
                  )}
                  <Text
                    className={`font-bold ${
                      a.done ? 'text-emerald-700' : 'text-secondary'
                    }`}
                    style={{ fontSize: 12.5 }}
                  >
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text
              className="border-t border-border px-3.5 py-2.5 text-muted-foreground"
              style={{ fontSize: 10.5, lineHeight: 14 }}
            >
              You always keep your single best one — never added together. The
              exact % is set by each place.
            </Text>
          </View>
        ) : null}

        {/* Live-ticket housekeeping */}
        {ticket?.status === 'open' ? (
          <Pressable
            onPress={() => void cancel()}
            disabled={cancelling}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-1.5"
            style={{ minHeight: 44 }}
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
    </FullScreenSheet>
  );
}
