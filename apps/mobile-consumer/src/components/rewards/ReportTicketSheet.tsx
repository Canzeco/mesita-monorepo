// v3c (MESITA-851) — the guest's route when a visit went wrong.
// Mirror of apps/web-consumer/src/components/consumer/rewards/ReportTicketSheet.tsx.
//
// The tone is doing real work. v3a moved the tasks off the floor on the
// premise that the guest's word is good; this sheet is the same premise
// pointed the other way, so it must not read like a complaint form that
// accuses a place. It asks what happened, says plainly that a human reads it,
// and never promises an outcome — a report is evidence, not a verdict, and
// the EF deliberately records no strike.

import { TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { REPORT_REASONS, type ReportReason } from '@/lib/api/tickets';

// Second-person copy — the operator-facing labels live in the EF's shared
// module and read differently on purpose.
const REASON_COPY: Record<ReportReason, { title: string; body: string }> = {
  discount_refused: {
    title: "They wouldn't apply my discount",
    body: 'You showed the pass and the place said no.',
  },
  closed_without_honoring: {
    title: 'The ticket closed but I got nothing',
    body: 'Marked done on their side, no discount on yours.',
  },
  qr_not_scanned: {
    title: "They wouldn't scan my QR",
    body: 'Staff refused or ignored the code.',
  },
  other: {
    title: 'Something else',
    body: 'Tell us in your own words.',
  },
};

export function ReportTicketSheet({
  open,
  placeName,
  busy,
  error,
  existingReason,
  onClose,
  onSubmit,
}: {
  open: boolean;
  placeName: string;
  busy: boolean;
  error: string | null;
  /** Set when the guest already filed — the sheet becomes an edit. */
  existingReason: ReportReason | null;
  onClose: () => void;
  onSubmit: (reason: ReportReason, detail: string) => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(existingReason);
  const [detail, setDetail] = useState('');

  return (
    <FullScreenSheet
      visible={open}
      onClose={onClose}
      title={existingReason ? 'Update your report' : 'What went wrong?'}
      subtitle={`A person at Mesita reads every one. ${placeName} is not told who reported.`}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 6 }}>
          {REPORT_REASONS.map((key) => {
            const copy = REASON_COPY[key];
            const active = reason === key;
            return (
              <Pressable
                key={key}
                onPress={() => setReason(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={`rounded-xl border px-3.5 py-2.5 ${
                  active ? 'border-red-500 bg-red-50' : 'border-border bg-card'
                }`}
              >
                <Text
                  className="font-bold text-foreground"
                  style={{ fontSize: 13, lineHeight: 17 }}
                >
                  {copy.title}
                </Text>
                <Text
                  className="mt-0.5 text-muted-foreground"
                  style={{ fontSize: 11.5, lineHeight: 15 }}
                >
                  {copy.body}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 6 }}>
          <Text className="font-semibold text-foreground" style={{ fontSize: 12 }}>
            Anything else? <Text className="font-normal text-muted-foreground">Optional</Text>
          </Text>
          <TextInput
            value={detail}
            onChangeText={setDetail}
            multiline
            numberOfLines={3}
            maxLength={1000}
            placeholder="What happened, in your words."
            placeholderTextColor="#77525499"
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-foreground"
            style={{ fontSize: 13, minHeight: 84, textAlignVertical: 'top' }}
          />
        </View>

        {error ? (
          <Text className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive" style={{ fontSize: 12 }}>
            {error}
          </Text>
        ) : null}

        <Pressable
          disabled={!reason || busy}
          onPress={() => reason && onSubmit(reason, detail)}
          accessibilityRole="button"
          className={`flex-row items-center justify-center rounded-xl bg-foreground ${
            !reason || busy ? 'opacity-50' : ''
          }`}
          style={{ minHeight: 48, gap: 8 }}
        >
          {busy ? <ActivityIndicator size="small" color="#fff7f8" /> : (
            <TriangleAlert color="#fff7f8" size={16} />
          )}
          <Text className="font-bold text-background" style={{ fontSize: 13.5 }}>
            {existingReason ? 'Update report' : 'Send report'}
          </Text>
        </Pressable>

        <Text
          className="text-center text-muted-foreground"
          style={{ fontSize: 11, lineHeight: 15 }}
        >
          This doesn&apos;t penalise the place on its own — it goes to a person who
          looks into it.
        </Text>
      </ScrollView>
    </FullScreenSheet>
  );
}
