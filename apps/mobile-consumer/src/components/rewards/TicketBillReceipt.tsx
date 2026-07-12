import { Text, View } from 'react-native';

import type { TicketBillPayload } from '@/lib/api/pay';
import {
  buildTicketReceipt,
  type TicketReceiptLine,
} from '@/lib/ticket-bill-receipt';

function ReceiptRow({ line }: { line: TicketReceiptLine }) {
  const isDeduction = line.kind === 'deduction';
  const isSubtotal = line.kind === 'subtotal';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        paddingTop: isSubtotal ? 8 : 0,
        borderTopWidth: isSubtotal ? 1 : 0,
        borderStyle: isSubtotal ? 'dashed' : 'solid',
        borderTopColor: 'rgba(235,217,219,0.8)',
      }}
    >
      <Text
        style={{
          flex: 1,
          fontSize: 14,
          color: isDeduction ? '#059669' : '#260409',
          fontWeight: isSubtotal ? '600' : '400',
        }}
      >
        {line.label}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          color: isDeduction ? '#059669' : '#260409',
          fontVariant: ['tabular-nums'],
        }}
      >
        {line.value}
      </Text>
    </View>
  );
}

export function TicketBillReceipt({
  payload,
  ticketKind,
  capMxn,
  placeName,
}: {
  payload: TicketBillPayload;
  ticketKind?: string | null;
  capMxn?: number | null;
  placeName?: string | null;
}) {
  const receipt = buildTicketReceipt(payload, ticketKind, { capMxn });
  if (!receipt?.lines.length) return null;

  const itemLines = receipt.lines.filter(
    (l) => l.kind === 'item' || l.kind === 'subtotal' || l.kind === 'deduction',
  );
  const totalLine = receipt.lines.find((l) => l.kind === 'total');
  const noteLines = receipt.lines.filter((l) => l.kind === 'note');

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(235,217,219,0.9)',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(235,217,219,0.7)',
          backgroundColor: 'rgba(255,247,248,0.5)',
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#260409' }}>
          {placeName ?? 'Your bill'}
        </Text>
        <Text style={{ marginTop: 2, fontSize: 12, color: '#775254' }}>
          What you owe at the restaurant
        </Text>
      </View>

      <View style={{ paddingHorizontal: 16, paddingVertical: 16, gap: 10 }}>
        {itemLines.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: '#775254',
              }}
            >
              Charges
            </Text>
            {itemLines.map((line, i) => (
              <ReceiptRow key={`${line.label}-${i}`} line={line} />
            ))}
          </View>
        ) : null}

        {totalLine ? (
          <View
            style={{
              marginTop: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              borderRadius: 12,
              backgroundColor: '#260409',
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
              {totalLine.label}
            </Text>
            <Text
              style={{
                color: '#fff',
                fontSize: 20,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
              }}
            >
              {totalLine.value}
            </Text>
          </View>
        ) : null}

        {noteLines.map((line, i) => (
          <Text
            key={`note-${i}`}
            style={{ marginTop: 4, fontSize: 12, color: '#775254', lineHeight: 16 }}
          >
            {line.label}
          </Text>
        ))}
      </View>

      {receipt.footerNote ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: 'rgba(235,217,219,0.7)',
            backgroundColor: 'rgba(255,247,248,0.4)',
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              fontSize: 12,
              color: '#775254',
              lineHeight: 16,
            }}
          >
            {receipt.footerNote}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
