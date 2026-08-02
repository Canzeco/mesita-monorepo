// Live ticket card on the Rewards "New" tab (Tickets v2, MESITA-806) —
// mirror of web CheckTicketCard. The QR IS the ticket: it encodes
// mesita.ai/check/<check_code>, the public page where staff verify, bill,
// and close the visit.

import { Image } from 'expo-image';
import { BadgeCheck, Loader2, ScanLine, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  Text,
  Vibration,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { formatCurrency } from '@/lib/api/pay';
import { checkUrlForCode, type ConsumerTicketRow } from '@/lib/api/tickets';

// Story lifecycle → the guest's one line (rejected must read differently
// from pending — the guest has to act, not wait).
const STORY_LINE: Record<string, string> = {
  pending: 'Bill is in. Post your tagged story so the place can approve it.',
  submitted: 'Story sent — the place is checking it.',
  ai_rejected: "Story wasn't accepted — ask the staff to review it.",
  staff_rejected: "Story wasn't accepted — ask the staff to review it.",
};

function statusLine(ticket: ConsumerTicketRow): string {
  switch (ticket.status) {
    case 'open':
      return 'Show this QR — staff scan it to verify and start your visit.';
    case 'awaiting_story':
      return STORY_LINE[ticket.story_status ?? ''] ?? STORY_LINE.pending;
    case 'awaiting_payment_confirm':
      return 'All set — pay the discounted total at the table.';
    default:
      return ticket.status;
  }
}

// QR clamp (Pass 6): the code shrinks before the status copy does.
const QR_SIZE = Math.min(190, Math.round(Dimensions.get('window').width * 0.6));

export function CheckTicketCard({
  ticket,
  onCancel,
}: {
  ticket: ConsumerTicketRow;
  onCancel: (ticketId: string) => Promise<void>;
}) {
  const [cancelling, setCancelling] = useState(false);
  const placeName = ticket.place?.name ?? 'Partner place';
  const photo = ticket.place?.photos?.[0] ?? null;
  const scanned = ticket.first_scanned_at != null;
  const billed = (ticket.total_cents ?? 0) > 0;

  // The verified pulse (MESITA-808, 4A): fires ONCE when the poll flips
  // first_scanned_at — emerald border flash + a short vibration (built-in
  // Vibration API; no haptics dep). Static color change, reduce-motion safe.
  const [pulse, setPulse] = useState(false);
  const wasScannedRef = useRef(scanned);
  useEffect(() => {
    if (scanned && !wasScannedRef.current) {
      Vibration.vibrate(30);
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1400);
      return () => clearTimeout(t);
    }
    wasScannedRef.current = scanned;
  }, [scanned]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await onCancel(ticket.id);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <View
      className="overflow-hidden rounded-[24px] border border-border bg-card"
      // Style wins over className only while pulsing — the token border
      // returns untouched afterwards.
      style={pulse ? { borderColor: '#059669', borderWidth: 2 } : undefined}
    >
      {/* Place header */}
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ width: 40, height: 40, borderRadius: 12 }}
            contentFit="cover"
          />
        ) : (
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <ScanLine size={16} color="#775254" />
          </View>
        )}
        <View className="min-w-0 flex-1">
          <Text className="font-bold text-foreground" numberOfLines={1} style={{ fontSize: 14 }}>
            {placeName}
          </Text>
          <View className="mt-0.5 flex-row items-center gap-1">
            {scanned ? <BadgeCheck size={12} color="#059669" /> : null}
            <Text
              accessibilityLiveRegion="polite"
              className="text-muted-foreground"
              style={{ fontSize: 11 }}
            >
              {scanned ? `Verified by ${placeName}` : 'Not scanned yet'}
            </Text>
          </View>
        </View>
        {ticket.status === 'open' ? (
          <Pressable
            onPress={() => void handleCancel()}
            disabled={cancelling}
            accessibilityRole="button"
            accessibilityLabel="Cancel ticket"
            className="h-8 w-8 items-center justify-center rounded-full active:opacity-70"
          >
            {cancelling ? (
              <Loader2 size={16} color="#775254" />
            ) : (
              <X size={16} color="#775254" />
            )}
          </Pressable>
        ) : null}
      </View>

      <View className="items-center gap-3 px-4 py-4">
        {ticket.check_code ? (
          <View
            className="items-center rounded-[20px] bg-white p-3.5"
            style={{
              shadowColor: '#781428',
              shadowOpacity: 0.35,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 8 },
              elevation: 5,
            }}
          >
            <QRCode
              value={checkUrlForCode(ticket.check_code)}
              size={QR_SIZE}
              backgroundColor="#ffffff"
              color="#2b1233"
              ecl="M"
            />
          </View>
        ) : null}

        <Text
          accessibilityLiveRegion="polite"
          className="text-center text-muted-foreground"
          style={{ fontSize: 12, maxWidth: 240 }}
        >
          {statusLine(ticket)}
        </Text>

        {billed ? (
          <LinearGradient
            colors={[...GRADIENTS.pink]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: '100%',
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <Text
              className="font-bold uppercase text-white"
              style={{ fontSize: 10, letterSpacing: 1.4, opacity: 0.85 }}
            >
              {ticket.discount_percent ?? 0}% off applied
            </Text>
            <Text
              className="font-display mt-0.5 font-bold text-white"
              style={{ fontSize: 24 }}
            >
              {/* total_cents is the PRE-discount bill; due = total − discount. */}
              {formatCurrency(
                Math.max(0, (ticket.total_cents ?? 0) - (ticket.discount_cents ?? 0)),
              )}
            </Text>
            <Text className="mt-1 text-white/90" style={{ fontSize: 11 }}>
              to pay at the table
              {ticket.discount_cents
                ? ` — you save ${formatCurrency(ticket.discount_cents)}`
                : ''}
            </Text>
          </LinearGradient>
        ) : null}

        {cancelling ? <ActivityIndicator /> : null}
      </View>
    </View>
  );
}
