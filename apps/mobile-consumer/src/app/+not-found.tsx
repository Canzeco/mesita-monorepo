import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Compass, MoveLeft } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';
import {
  GRADIENT_DIAGONAL,
  GRADIENTS,
  SHADOW_ELEV,
  SHADOW_GLOW,
} from '@/constants/brand';

// Branded 404 — RN port of apps/web-consumer not-found.tsx. Any unmatched
// deep link lands here instead of Expo Router's raw default. The single CTA
// points at "/" on purpose: index.tsx re-gates for BOTH states (signed-out →
// sign-in, signed-in → home/onboard), so it can never strand a signed-out
// user behind the auth wall.
export default function NotFound() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#fff7f8' }}>
      <HeroBackdrop />
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
          }}
        >
          <View
            className="w-full rounded-3xl border border-border bg-card"
            style={{
              maxWidth: 360,
              paddingHorizontal: 24,
              paddingVertical: 40,
              alignItems: 'center',
              ...SHADOW_ELEV,
            }}
          >
            <LinearGradient
              colors={[...GRADIENTS.peacock]}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
                ...SHADOW_GLOW,
              }}
            >
              <Compass color="#ffffff" size={24} />
            </LinearGradient>

            <Text
              className="font-bold text-muted-foreground"
              style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}
            >
              Error 404
            </Text>
            <Text
              className="font-display font-semibold text-foreground"
              style={{
                fontSize: 22,
                marginTop: 8,
                textAlign: 'center',
                letterSpacing: -0.33,
              }}
            >
              This page doesn&apos;t exist
            </Text>
            <Text
              className="text-muted-foreground"
              style={{
                fontSize: 14,
                marginTop: 8,
                textAlign: 'center',
                lineHeight: 21,
              }}
            >
              The link may be broken or the page may have moved. Let&apos;s get
              you back to Mesita.
            </Text>

            <View style={{ marginTop: 28, alignSelf: 'stretch' }}>
              <Button
                onPress={() => router.replace('/')}
                accessibilityLabel="Back to Mesita"
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <MoveLeft color="#fffafb" size={16} />
                  <Text
                    className="font-semibold text-primary-foreground"
                    style={{ fontSize: 14 }}
                  >
                    Back to Mesita
                  </Text>
                </View>
              </Button>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
