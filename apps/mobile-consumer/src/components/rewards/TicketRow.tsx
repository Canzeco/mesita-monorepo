// Compact ticket row (MESITA-857) — mobile mirror: the wallet's Pending and
// History lists are doors into THE ticket screen; one row serves both.

import { Image } from 'expo-image';
import { ChevronRight, ScanLine } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { formatCurrency } from '@/lib/api/pay';
import type { ConsumerTicketRow } from '@/lib/api/tickets';

function caption(t: ConsumerTicketRow): string {
  switch (t.status) {
    case 'open':
      return t.first_scanned_at ? 'Scanned — visit started' : 'Open — show your QR';
    case 'awaiting_payment_confirm':
      return 'Pay the discounted total';
    case 'revealed':
      return t.discount_percent ? `${t.discount_percent}% off` : 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return t.status;
  }
}

export function TicketRow({
  ticket,
  onOpen,
}: {
  ticket: ConsumerTicketRow;
  onOpen: () => void;
}) {
  const photo = ticket.place?.photos?.[0] ?? null;
  const saved =
    ticket.status === 'revealed' ? (ticket.discount_cents ?? 0) : 0;
  const scannedLive =
    ticket.status !== 'revealed' &&
    ticket.status !== 'cancelled' &&
    ticket.first_scanned_at != null;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      className="flex-row items-center rounded-2xl border border-border bg-card px-3.5 py-3 active:bg-muted/40"
      style={{ minHeight: 64, gap: 12 }}
    >
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            opacity: ticket.status === 'cancelled' ? 0.5 : 1,
          }}
          contentFit="cover"
        />
      ) : (
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <ScanLine size={20} color="#775254" />
        </View>
      )}
      <View className="min-w-0 flex-1">
        <Text
          className="font-bold text-foreground"
          numberOfLines={1}
          style={{ fontSize: 13.5 }}
        >
          {ticket.place?.name ?? 'Partner place'}
        </Text>
        <Text
          className={
            scannedLive ? 'mt-0.5 font-semibold text-emerald-700' : 'mt-0.5 text-muted-foreground'
          }
          numberOfLines={1}
          style={{ fontSize: 11.5 }}
        >
          {caption(ticket)}
        </Text>
      </View>
      {saved > 0 ? (
        <Text className="font-extrabold text-emerald-700" style={{ fontSize: 13.5 }}>
          −{formatCurrency(saved)}
        </Text>
      ) : (
        <ChevronRight size={16} color="#775254" />
      )}
    </Pressable>
  );
}
