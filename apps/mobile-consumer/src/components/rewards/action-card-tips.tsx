import { Lock } from 'lucide-react-native';
import { Text, View } from 'react-native';

export function LockedBanner() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        borderRadius: 16,
        backgroundColor: 'rgba(255,247,248,0.7)',
        padding: 12,
      }}
    >
      <Lock color="#775254" size={20} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, fontSize: 14, color: '#775254', lineHeight: 20 }}>
        This comes later. Finish what’s highlighted in pink above first.
      </Text>
    </View>
  );
}

export function TipRows({ tips }: { tips: string[] }) {
  return (
    <>
      {tips.map((line, i) => (
        <View
          key={i}
          style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              backgroundColor: 'rgba(251,43,123,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fb2b7b' }}>
              {i + 1}
            </Text>
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 15,
              color: '#260409',
              lineHeight: 22,
              paddingTop: 1,
            }}
          >
            {line}
          </Text>
        </View>
      ))}
    </>
  );
}
