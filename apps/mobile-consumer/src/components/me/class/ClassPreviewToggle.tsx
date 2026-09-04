import { Pressable, Text, View } from 'react-native';

import {
  useEffectiveClass,
  useMockClass,
  type MockClass,
} from '@/lib/mock-class';
import { useAuth } from '@/providers/auth';

export function ClassPreviewToggle() {
  const [override, setOverride] = useMockClass();
  const { consumerClass, profile } = useAuth();
  const effective = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  // MockClass values ARE class keys (segments v6), so the selected chip is
  // simply the effective class.
  const selected: MockClass = override ?? effective.key;

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
        <Text style={{ color: '#775254' }}>Preview</Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#ebd9db',
          backgroundColor: '#faeff0',
          padding: 4,
          gap: 4,
        }}
      >
        {(
          [
            { value: 'standard', label: 'Bronze' },
            { value: 'influencer', label: 'Silver' },
            { value: 'premium', label: 'Gold' },
            { value: 'aura', label: 'Diamond' },
          ] as const
        ).map((opt) => {
          const active = selected === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setOverride(opt.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={{
                flex: 1,
                alignItems: 'center',
                borderRadius: 10,
                paddingVertical: 10,
                backgroundColor: active ? '#ffffff' : 'transparent',
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontWeight: '600',
                  fontSize: 11,
                  color: active ? '#260409' : '#775254',
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
