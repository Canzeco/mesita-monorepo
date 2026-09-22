import { Text, TextInput, View } from 'react-native';

import { StarRatingRow } from '@/components/rewards/StarRatingRow';
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/constants/brand';

const NOTE_MIN = 50;

export type TicketReviewDraft = {
  food: number;
  service: number;
  ambience: number;
  value: number;
  overall: number;
  comments: string;
};

export function TicketReviewForm({
  draft,
  onChange,
  onSubmit,
  busy,
  error,
}: {
  draft: TicketReviewDraft;
  onChange: (draft: TicketReviewDraft) => void;
  onSubmit: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const ratingsSet =
    draft.overall > 0 &&
    draft.food > 0 &&
    draft.service > 0 &&
    draft.ambience > 0 &&
    draft.value > 0;
  const noteLen = draft.comments.trim().length;
  const canSubmit = ratingsSet && noteLen >= NOTE_MIN;

  const dims: {
    key: keyof Pick<
      TicketReviewDraft,
      'food' | 'service' | 'ambience' | 'value'
    >;
    label: string;
  }[] = [
    { key: 'food', label: 'Food' },
    { key: 'service', label: 'Service' },
    { key: 'ambience', label: 'Ambience' },
    { key: 'value', label: 'Value' },
  ];

  return (
    <View style={{ gap: 4 }}>
      <StarRatingRow
        label="Overall"
        value={draft.overall}
        onChange={(overall) => onChange({ ...draft, overall })}
        size="hero"
      />
      {dims.map(({ key, label }) => (
        <StarRatingRow
          key={key}
          label={label}
          value={draft[key]}
          onChange={(n) => onChange({ ...draft, [key]: n })}
          size="compact"
        />
      ))}

      <View style={{ marginTop: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: COLORS.foreground,
            }}
          >
            Notes
          </Text>
          {/* The green/grey flip was the ONLY live feedback for the gate that
              disables Send review (canSubmit reads the same predicate above),
              and the helper sentence below it vanishes the instant the gate
              passes. Greyscaled by lightness the two states would have landed
              ~16 L* apart AND INVERTED — the 'you can send now' state lighter
              and weaker than 'you cannot' — at 11px. So the distinction moves
              onto WEIGHT: cleared reads at full ink and bold, below the line
              stays muted at normal weight. */}
          <Text
            style={{
              fontSize: 11,
              color:
                noteLen >= NOTE_MIN ? COLORS.foreground : COLORS.mutedForeground,
              fontWeight: noteLen >= NOTE_MIN ? '700' : '400',
              fontVariant: ['tabular-nums'],
            }}
          >
            {noteLen}/{NOTE_MIN}
          </Text>
        </View>
        <TextInput
          value={draft.comments}
          onChangeText={(comments) => onChange({ ...draft, comments })}
          placeholder="e.g. great tacos, slow drinks…"
          multiline
          numberOfLines={2}
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 12,
            padding: 12,
            minHeight: 64,
            backgroundColor: COLORS.card,
            color: COLORS.foreground,
            textAlignVertical: 'top',
          }}
          placeholderTextColor="rgba(93,93,93,0.5)"
        />
      </View>

      {error ? (
        <Text
          style={{
            fontSize: 12,
            // RESERVED: danger keeps its hue. These were raw Tailwind reds
            // rather than the destructive token, so a token-driven carve-out
            // would have missed them and greyed the one error in this screen
            // while every other error in the area kept its red.
            color: COLORS.destructive,
            backgroundColor: `${COLORS.destructive}1a`,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
          }}
        >
          {error}
        </Text>
      ) : null}

      {!canSubmit ? (
        <Text style={{ color: COLORS.mutedForeground, fontSize: 12 }}>
          {ratingsSet
            ? `Your note needs at least ${NOTE_MIN} characters.`
            : 'Rate every row to continue.'}
        </Text>
      ) : null}

      <Button
        onPress={onSubmit}
        loading={busy}
        disabled={busy || !canSubmit}
        accessibilityLabel="Send review"
      >
        Send review
      </Button>
    </View>
  );
}
