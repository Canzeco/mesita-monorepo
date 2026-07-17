import { Lock } from 'lucide-react-native';
import { Text, View } from 'react-native';

export function StatusPill({
  done,
  active,
  locked,
}: {
  done: boolean;
  active: boolean;
  locked: boolean;
}) {
  if (active) {
    return (
      <View
        style={{
          alignSelf: 'flex-start',
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.2)',
          paddingHorizontal: 10,
          paddingVertical: 2,
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          Do this now
        </Text>
      </View>
    );
  }
  if (done) {
    return (
      <View
        style={{
          alignSelf: 'flex-start',
          borderRadius: 999,
          backgroundColor: 'rgba(16,185,129,0.15)',
          paddingHorizontal: 10,
          paddingVertical: 2,
        }}
      >
        <Text
          style={{
            color: '#059669',
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          Done
        </Text>
      </View>
    );
  }
  if (locked) {
    return (
      <View
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.8)',
          paddingHorizontal: 10,
          paddingVertical: 2,
        }}
      >
        <Lock color="#775254" size={12} />
        <Text
          style={{
            color: '#775254',
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          Later
        </Text>
      </View>
    );
  }
  return null;
}
