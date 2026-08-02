// The venue pass (Wallet v3, MESITA-811) — mobile mirror: tap a place in New
// and this modal IS your Mesita pass for that venue — class-tinted card, the
// ticket QR, live status. Reuses the venue's open ticket when one exists,
// otherwise creates on open; Influencers get one interstitial tap (the Story
// opt-in is create-time only). NO member code (MESITA-820): check-web-get-ticket
// resolves ONLY the per-ticket check_code, and _shared/ticket-check.ts forbids
// consumers.code from ever reaching the staff page.

import {
  BadgeCheck,
  Camera,
  Check,
  PartyPopper,
  Sparkles,
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
  checkUrlForCode,
  type ConsumerTicketRow,
} from '@/lib/api/tickets';
import { classProperLabel } from '@/lib/consumer-classes';
import { EFError } from '@/lib/ef';
import type { ConsumerTicketsState } from '@/lib/hooks/useConsumerTickets';
import { useAuth } from '@/providers/auth';

// Class-tinted pass gradients — ported from the retired passport card (#548).
const PASS_GRADIENTS: Record<string, [string, string, string]> = {
  standard: ['#ff7a45', '#ff4d6d', '#ff2d78'],
  premium: ['#ff7a45', '#ff3d73', '#a13cf0'],
  influencer: ['#ff7a45', '#4aa8ff', '#2f7fd6'],
  aura: ['#ff7a45', '#ffb03d', '#e0982e'],
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
  const { consumerClass } = useAuth();
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


  const placeName = place?.name ?? 'the place';
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
          </LinearGradient>
        </View>

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
