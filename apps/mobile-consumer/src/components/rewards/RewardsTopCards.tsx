import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Info, Percent, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { useAuth } from '@/providers/auth';

const ORIGIN_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  subscription: 'Subscription',
  invitation: 'Invite',
  default: 'Mesita',
};

// decision: Unlock Premium routes to Me (status only) — no Stripe in iOS binary.
export function RewardsTopCards() {
  const { consumerClass } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isPremium = consumerClass?.class === 'premium';
  const origin = consumerClass?.origin ?? 'default';
  const [howOpen, setHowOpen] = useState(false);

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 10 }}>
        <Pressable
          onPress={() => router.push('/(tabs)/me')}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#ebd9db',
            backgroundColor: '#ffffff',
            padding: 12,
            opacity: pressed ? 0.96 : 1,
          })}
        >
          <LinearGradient
            colors={[...GRADIENTS.premium]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isPremium ? (
              <Crown color="#fff" size={18} fill="#fff" />
            ) : (
              <Sparkles color="#fff" size={18} />
            )}
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 13, fontWeight: '700', color: '#260409' }}
            >
              {isPremium ? 'Premium active' : 'Unlock Premium'}
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontSize: 11, color: '#775254', marginTop: 1 }}
            >
              {isPremium
                ? `via ${ORIGIN_LABEL[origin] ?? 'Mesita'}`
                : 'Manage on the web · Me'}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setHowOpen(true)}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#ebd9db',
            backgroundColor: '#ffffff',
            padding: 12,
            opacity: pressed ? 0.96 : 1,
          })}
        >
          <LinearGradient
            colors={['#ff7a45', '#ff2d78']}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Percent color="#fff" size={18} strokeWidth={2.5} />
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 13, fontWeight: '700', color: '#260409' }}
            >
              How it works
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontSize: 11, color: '#775254', marginTop: 1 }}
            >
              Instant off the bill
            </Text>
          </View>
        </Pressable>
      </View>

      <Modal
        visible={howOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setHowOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(38,4,9,0.4)' }}
          onPress={() => setHowOpen(false)}
        />
        <View
          style={{
            backgroundColor: '#fff7f8',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom, 24) + 8,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: 'rgba(251,43,123,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Info color="#fb2b7b" size={18} />
            </View>
            <Text variant="titleLarge" style={{ fontWeight: '700' }}>
              How rewards work
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: 'rgba(16,185,129,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Percent color="#059669" size={18} strokeWidth={2.25} />
            </View>
            <Text
              variant="bodyMedium"
              style={{ flex: 1, color: '#775254', lineHeight: 20 }}
            >
              <Text style={{ fontWeight: '600', color: '#260409' }}>
                Instant discounts.{' '}
              </Text>
              Show your QR or code at the check — it comes straight off the
              bill. Mesita never holds your money.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <LinearGradient
              colors={[...GRADIENTS.premium]}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Crown color="#fff" size={18} fill="#fff" />
            </LinearGradient>
            <Text
              variant="bodyMedium"
              style={{ flex: 1, color: '#775254', lineHeight: 20 }}
            >
              <Text style={{ fontWeight: '600', color: '#260409' }}>
                Premium boosts them.{' '}
              </Text>
              Free gets the base discount; Premium unlocks bigger ones — free
              with Instagram. Manage Premium on the web.
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}
