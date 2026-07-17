import { Star } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

export function StarRatingRow({
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
