// Live ticket card on the Rewards "New" tab (Tickets v2, MESITA-806) —
// mirror of web CheckTicketCard. The QR IS the ticket: it encodes
// mesita.ai/check/<check_code>, the public page where staff verify, bill,
// and close the visit.

import { Image } from 'expo-image';
import { BadgeCheck, Loader2, ScanLine, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { formatCurrency } from '@/lib/api/pay';
import { checkUrlForCode, type ConsumerTicketRow } from '@/lib/api/tickets';

const STATUS_LINE: Record<string, string> = {
  open: 'Show this QR — staff scan it to verify and start your visit.',
  awaiting_story: 'Bill is in. Post your tagged story so the place can approve it.',
  awaiting_payment_confirm: 'All set — pay the discounted total at the table.',
};

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

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await onCancel(ticket.id);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <View className="overflow-hidden rounded-[24px] border border-border bg-card">
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
            <Text className="text-muted-foreground" style={{ fontSize: 11 }}>
              {scanned ? 'Scanned by the place' : 'Not scanned yet'}
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
              size={190}
              backgroundColor="#ffffff"
              color="#2b1233"
              ecl="M"
            />
          </View>
        ) : null}

        <Text
          className="text-center text-muted-foreground"
          style={{ fontSize: 12, maxWidth: 240 }}
        >
          {STATUS_LINE[ticket.status] ?? ticket.status}
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
              {formatCurrency(ticket.total_cents ?? 0)}
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
