import { Text, View } from 'react-native';

const COMPARE_ROWS = [
  { label: 'Discounts', free: 'Base', premium: 'Boosted' },
  { label: 'Recommendations', free: 'Standard', premium: 'Personalized' },
  { label: 'Max monthly reservations', free: '2', premium: 'Unlimited' },
];

export function FreeVsPremium() {
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#ebd9db',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        paddingVertical: 6,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 12,
          paddingTop: 8,
          gap: 4,
        }}
      >
        <View style={{ flex: 1.3 }} />
        <Text
          style={{ flex: 0.8, textAlign: 'center', fontWeight: '700' }}
        >
          Free
        </Text>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(139,108,232,0.07)',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            paddingVertical: 4,
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              fontWeight: '700',
              color: '#6d4fd8',
            }}
          >
            ★ Premium
          </Text>
        </View>
      </View>
      {COMPARE_ROWS.map((row, i) => (
        <View
          key={row.label}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 14,
            gap: 4,
            borderTopWidth: i > 0 ? 1 : 0,
            borderTopColor: 'rgba(235,217,219,0.5)',
          }}
        >
          <Text
            style={{ flex: 1.3, color: 'rgba(38,4,9,0.8)', fontWeight: '500' }}
          >
            {row.label}
          </Text>
          <Text
            style={{ flex: 0.8, textAlign: 'center', fontWeight: '600' }}
          >
            {row.free}
          </Text>
          <Text
            style={{
              flex: 1,
              textAlign: 'center',
              fontWeight: '600',
              color: '#6d4fd8',
              backgroundColor: 'rgba(139,108,232,0.07)',
              overflow: 'hidden',
              borderRadius: 8,
              paddingVertical: 6,
            }}
          >
            {row.premium}
          </Text>
        </View>
      ))}
    </View>
  );
}
