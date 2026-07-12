import { Star } from 'lucide-react-native';
import { Pressable, Text, TextInput, View } from 'react-native';

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

function StarRatingRow({
  label,
  hint,
  value,
  onChange,
  emphasized = false,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  emphasized?: boolean;
}) {
  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: emphasized ? 'rgba(38,4,9,0.15)' : 'rgba(235,217,219,0.8)',
        backgroundColor: emphasized ? 'rgba(255,247,248,0.8)' : '#ffffff',
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Text
          style={{
            fontWeight: '500',
            fontSize: emphasized ? 14 : 13,
            color: '#260409',
          }}
        >
          {label}
        </Text>
        <Text style={{ color: '#775254', fontSize: 12, fontVariant: ['tabular-nums'] }}>
          {value}/5
        </Text>
      </View>
      {hint ? (
        <Text style={{ marginTop: 2, color: '#775254', fontSize: 11 }}>{hint}</Text>
      ) : null}
      <View
        style={{
          marginTop: 6,
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 4,
        }}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value >= n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              accessibilityLabel={`${label}: ${n} star${n === 1 ? '' : 's'}`}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 2,
              }}
            >
              <Star
                size={28}
                color={on ? '#fbbf24' : 'rgba(119,82,84,0.35)'}
                fill={on ? '#fbbf24' : 'transparent'}
                strokeWidth={on ? 0 : 1.5}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function TicketReviewForm({
  draft,
  onChange,
  onSubmit,
  busy,
  showIntro = true,
}: {
  draft: TicketReviewDraft;
  onChange: (draft: TicketReviewDraft) => void;
  onSubmit: () => void;
  busy?: boolean;
  showIntro?: boolean;
}) {
  const ratingsSet =
    draft.overall > 0 &&
    draft.food > 0 &&
    draft.service > 0 &&
    draft.ambiance > 0 &&
    draft.value > 0;
  const noteLen = draft.comments.trim().length;
  const canSubmit = ratingsSet && noteLen >= NOTE_MIN;

  return (
    <View style={{ gap: 12 }}>
      {showIntro ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: '#775254', fontSize: 13 }}>
            1. Tap stars on each row — 1 is bad, 5 is great.
          </Text>
          <Text style={{ color: '#775254', fontSize: 13 }}>
            2. Fill in Overall first, then Food, Service, Ambiance, and Value.
          </Text>
          <Text style={{ color: '#775254', fontSize: 13 }}>
            3. Add a note about your visit, then tap Send review.
          </Text>
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <StarRatingRow
          label="Overall"
          hint="How was the visit in general?"
          value={draft.overall}
          onChange={(overall) => onChange({ ...draft, overall })}
          emphasized
        />
        <StarRatingRow
          label="Food"
          value={draft.food}
          onChange={(food) => onChange({ ...draft, food })}
        />
        <StarRatingRow
          label="Service"
          value={draft.service}
          onChange={(service) => onChange({ ...draft, service })}
        />
        <StarRatingRow
          label="Ambiance"
          value={draft.ambiance}
          onChange={(ambiance) => onChange({ ...draft, ambiance })}
        />
        <StarRatingRow
          label="Value"
          value={draft.value}
          onChange={(value) => onChange({ ...draft, value })}
        />
      </View>

      <View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '500', color: '#260409' }}>
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

      {!canSubmit ? (
        <Text style={{ textAlign: 'center', color: '#775254', fontSize: 12 }}>
          {ratingsSet
            ? `Your note needs at least ${NOTE_MIN} characters.`
            : 'Tap a rating on every row to continue.'}
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
