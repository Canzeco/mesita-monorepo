import { AtSign, Crown } from 'lucide-react-native';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Switch, Text } from 'react-native-paper';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import {
  useEffectiveClass,
  useMockClass,
} from '@/lib/mock-class';
import { useAuth } from '@/providers/auth';

// Demo-only emulation controls while conversion rows can be previewed without
// real billing / 1K IG. Mirrors web MockControls.

export function MockControls() {
  const { consumerClass, profile } = useAuth();
  const { key, origin } = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  const [override, setMockClass] = useMockClass();
  const igOn = origin === 'instagram';
  const classPremium = key === 'premium';

  return (
    <View
      style={{
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(235,217,219,0.9)',
        borderRadius: 16,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text
          variant="labelSmall"
          style={{
            backgroundColor: 'rgba(245,158,11,0.15)',
            color: '#d97706',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            overflow: 'hidden',
            fontWeight: '800',
            letterSpacing: 1.2,
          }}
        >
          DEMO
        </Text>
        <Text
          variant="labelSmall"
          style={{ color: '#775254', flex: 1, fontWeight: '600' }}
        >
          Emulate account states
        </Text>
        {override ? (
          <Text
            variant="labelSmall"
            style={{
              color: '#775254',
              fontWeight: '700',
              textDecorationLine: 'underline',
            }}
            onPress={() => setMockClass(null)}
          >
            Reset
          </Text>
        ) : null}
      </View>

      <EmulateRow
        ig
        title="Emulate Instagram"
        summary="Preview the Instagram-connected profile"
        on={igOn}
        onToggle={() => setMockClass(igOn ? 'free' : 'instagram')}
      />
      <EmulateRow
        title="Emulate Class"
        summary="Preview Mesita Premium"
        on={classPremium}
        onToggle={() => setMockClass(classPremium ? 'free' : 'subscription')}
      />
    </View>
  );
}

function EmulateRow({
  ig,
  title,
  summary,
  on,
  onToggle,
}: {
  ig?: boolean;
  title: string;
  summary: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ebd9db',
        backgroundColor: '#ffffff',
        padding: 12,
      }}
    >
      {ig ? (
        <LinearGradient
          colors={['#f58529', '#dd2a7b', '#8134af']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AtSign color="#fff" size={18} />
        </LinearGradient>
      ) : (
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Crown color="#fff" size={18} />
        </LinearGradient>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="titleSmall" style={{ fontWeight: '700' }}>
          {title}
        </Text>
        <Text variant="labelSmall" style={{ color: '#775254' }} numberOfLines={1}>
          {summary}
        </Text>
      </View>
      <Switch value={on} onValueChange={onToggle} />
    </View>
  );
}
