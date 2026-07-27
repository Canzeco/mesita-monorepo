import { Crown } from 'lucide-react-native';
import { Text, View } from 'react-native';

const COMPARE_ROWS = [
  { label: 'Discounts', standard: 'Base', premium: 'Boosted' },
  { label: 'Recommendations', standard: 'Standard', premium: 'Personalized' },
  { label: 'Max monthly reservations', standard: '2', premium: 'Unlimited' },
];

export function FreeVsPremium() {
  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card px-2 py-1.5">
      <View className="flex-row items-end gap-1 px-2 pt-2">
        <View style={{ flex: 1.3 }} />
        <CompareHead label="Standard" style={{ flex: 0.8 }} />
        <CompareHead label="Premium" accent style={{ flex: 1 }} />
      </View>
      <View className="mt-1">
        {COMPARE_ROWS.map((row, i) => (
          <View
            key={row.label}
            className={`flex-row items-center gap-1 px-2 py-3.5 ${
              i > 0 ? 'border-t border-border/50' : ''
            }`}
          >
            <Text
              className="font-medium leading-tight text-foreground/80"
              style={{ flex: 1.3, fontSize: 12.5 }}
            >
              {row.label}
            </Text>
            <Text
              className="text-center font-semibold text-foreground/70"
              style={{ flex: 0.8, fontSize: 12.5 }}
            >
              {row.standard}
            </Text>
            <Text
              className="rounded-lg bg-violet-500/[0.07] py-1.5 text-center font-semibold text-violet-600"
              style={{ flex: 1, fontSize: 12.5, overflow: 'hidden' }}
            >
              {row.premium}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CompareHead({
  label,
  accent,
  style,
}: {
  label: string;
  accent?: boolean;
  style?: object;
}) {
  return (
    <View
      className={`items-center rounded-t-lg px-1 py-1.5 ${
        accent ? 'bg-violet-500/[0.07]' : ''
      }`}
      style={style}
    >
      <View className="flex-row items-center gap-1">
        {accent ? (
          <Crown color="#6d4fd8" size={12} fill="#6d4fd8" />
        ) : null}
        <Text
          className={`font-display font-bold tracking-tight ${
            accent ? 'text-violet-600' : 'text-foreground'
          }`}
          style={{ fontSize: 13 }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}
