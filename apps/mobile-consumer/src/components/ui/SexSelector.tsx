import { Pressable, Text, View } from 'react-native';

// Male/Female only — "other" was dropped from the product (MESITA-727).
const SEX_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
] as const;

export type SexValue = (typeof SEX_OPTIONS)[number]['value'];

// Narrow a stored consumers.sex string (free-form in the DB, and null on
// profiles that predate the field) to the two values the product accepts.
export function toSexValue(stored: string | null | undefined): SexValue | null {
  return stored === 'male' || stored === 'female' ? stored : null;
}

// Segmented Male/Female control, shared by onboarding and the Personal
// details sheet so the two can't drift apart (web-consumer parity: both
// surfaces there offer the same choice).
export function SexSelector({
  value,
  onChange,
}: {
  value: SexValue | null;
  onChange: (value: SexValue) => void;
}) {
  return (
    <View className="flex-row rounded-2xl border border-border bg-muted p-1">
      {SEX_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={
              active
                ? 'flex-1 items-center rounded-xl bg-card px-3 py-3'
                : 'flex-1 items-center rounded-xl px-3 py-3'
            }
          >
            <Text
              className={
                active
                  ? 'font-semibold text-foreground'
                  : 'font-semibold text-muted-foreground'
              }
              style={{ fontSize: 13 }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
