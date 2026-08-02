// History row for the Rewards tab (Tickets v2, MESITA-806) — mobile mirror
// of web HistoryTicketCard. Ticket-driven, so cancelled-before-billing
// visits appear too. Billed tickets tap through to the detail; unbilled
// cancelled ones have no receipt, so they don't link.

import { Image } from 'expo-image';
import { CheckCircle2, ScanLine, XCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { formatCurrency, formatTicketVisitDate } from '@/lib/api/pay';
import type { ConsumerTicketRow } from '@/lib/api/tickets';
import { rewardsTicketPath } from '@/lib/consumer-route-contract';

export function HistoryTicketCard({ ticket }: { ticket: ConsumerTicketRow }) {
  const router = useRouter();
  const placeName = ticket.place?.name ?? 'Partner place';
  const photo = ticket.place?.photos?.[0] ?? null;
  const cancelled = ticket.status === 'cancelled';
  const billed = (ticket.total_cents ?? 0) > 0;
  const linkable = billed && !cancelled;

  const body = (
    <>
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{ width: 44, height: 44, borderRadius: 12 }}
          contentFit="cover"
        />
      ) : (
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-muted">
          <ScanLine size={16} color="#775254" />
        </View>
      )}
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-foreground" numberOfLines={1} style={{ fontSize: 13.5 }}>
          {placeName}
        </Text>
        <Text className="mt-0.5 text-muted-foreground" style={{ fontSize: 11 }}>
          {formatTicketVisitDate(
            ticket.revealed_at ?? ticket.cancelled_at ?? ticket.created_at,
          ) ?? '—'}
        </Text>
      </View>
      <View className="items-end">
        {cancelled ? (
          <View className="flex-row items-center gap-1">
            <XCircle size={14} color="#775254" />
            <Text className="font-semibold text-muted-foreground" style={{ fontSize: 11.5 }}>
              Cancelled
            </Text>
          </View>
        ) : (
          <>
            <View className="flex-row items-center gap-1">
              <CheckCircle2 size={14} color="#047857" />
              <Text className="font-semibold" style={{ fontSize: 11.5, color: '#047857' }}>
                Paid
              </Text>
            </View>
            {ticket.discount_cents ? (
              <Text className="text-muted-foreground" style={{ fontSize: 11 }}>
                saved {formatCurrency(ticket.discount_cents)}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </>
  );

  const base = 'flex-row items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3';

  return linkable ? (
    <Pressable
      onPress={() => router.push(rewardsTicketPath(ticket.id))}
      className={`${base} active:opacity-90`}
    >
      {body}
    </Pressable>
  ) : (
    <View className={`${base} ${cancelled ? 'opacity-70' : ''}`}>{body}</View>
  );
}
