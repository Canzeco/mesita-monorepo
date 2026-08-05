import { Text, TextInput, View } from 'react-native';

import { StarRatingRow } from '@/components/rewards/StarRatingRow';
import { Button } from '@/components/ui/Button';

const NOTE_MIN = 50;

export type TicketReviewDraft = {
  food: number;
  service: number;
  ambiance: number;
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
    draft.ambiance > 0 &&
    draft.value > 0;
  const noteLen = draft.comments.trim().length;
  const canSubmit = ratingsSet && noteLen >= NOTE_MIN;

  const dims: {
    key: keyof Pick<
      TicketReviewDraft,
      'food' | 'service' | 'ambiance' | 'value'
    >;
    label: string;
  }[] = [
    { key: 'food', label: 'Food' },
    { key: 'service', label: 'Service' },
    { key: 'ambiance', label: 'Ambiance' },
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
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#260409' }}>
            Notes
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: noteLen >= NOTE_MIN ? '#059669' : '#775254',
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
            borderColor: '#ebd9db',
            borderRadius: 12,
            padding: 12,
            minHeight: 64,
            backgroundColor: '#ffffff',
            color: '#260409',
            textAlignVertical: 'top',
          }}
          placeholderTextColor="rgba(119,82,84,0.5)"
        />
      </View>

      {error ? (
        <Text
          style={{
            fontSize: 12,
            color: '#b91c1c',
            backgroundColor: '#fef2f2',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
          }}
        >
          {error}
        </Text>
      ) : null}

      {!canSubmit ? (
        <Text style={{ color: '#775254', fontSize: 12 }}>
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
