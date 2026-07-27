import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Copy, Crown, Flame } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { classProperLabel, isElevatedClass } from '@/lib/consumer-classes';
import { displayConsumerCode } from '@/lib/consumer-code';
import type { RewardStats } from '@/lib/hooks/useConsumerPayTickets';
import { useAuth } from '@/providers/auth';

import { IdentityStrip, IgChips, Scorecard } from './my-qr-card-parts';

// Coral Mesita Card passport — web MyQrCard.tsx port (MESITA-580).
// Standard: #ff7a45→#ff2d78 · Premium: →#a13cf0 · Magnetic: →gold #e0982e.
// QR plate ink #2b1233. White-on-coral is the one intentional white-on-color
// surface here.

const PASSPORT_SHADOW = {
  shadowColor: '#ff4d6d',
  shadowOpacity: 0.55,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 12 },
  elevation: 10,
} as const;

const QR_PLATE_SHADOW = {
  shadowColor: '#781428',
  shadowOpacity: 0.45,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
} as const;

export function MyQrCard({
  code,
  name,
  instagramHandle,
  stats,
}: {
  code: string;
  name?: string;
  instagramHandle?: string | null;
  stats?: RewardStats;
}) {
  const { consumerClass } = useAuth();
  const displayCode = displayConsumerCode(code);
  const classKey = consumerClass?.class ?? 'standard';
  const isElevated = isElevatedClass(classKey);
  const origin = consumerClass?.origin ?? 'default';
  const followerCount = consumerClass?.followers ?? 0;

  const displayName = name?.trim() || 'Mesita member';
  const igConnected = origin === 'instagram' || Boolean(instagramHandle);

  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await Clipboard.setStringAsync(displayCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard unavailable
    }
  };

  const s = stats ?? { visits: 0, savedCents: 0, stories: 0, reviews: 0 };
  // Standard = coral; Premium adds violet; Magnetic (top tier) shifts to gold.
  const gradientColors =
    classKey === 'magnetic'
      ? (['#ff7a45', '#ffb03d', '#e0982e'] as const)
      : isElevated
        ? (['#ff7a45', '#ff3d73', '#a13cf0'] as const)
        : (['#ff7a45', '#ff4d6d', '#ff2d78'] as const);

  return (
    <LinearGradient
      colors={[...gradientColors]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[
        {
          borderRadius: 28,
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 20,
          overflow: 'hidden',
        },
        PASSPORT_SHADOW,
      ]}
    >
      {/* Header — brand + class chip */}
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-[9px] bg-white/20">
            <Flame color="#fff" size={16} fill="#fff" />
          </View>
          <Text className="text-sm font-extrabold tracking-tight text-white">
            Mesita Card
          </Text>
        </View>
        <View className="shrink-0 flex-row items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1">
          {isElevated ? <Crown color="#fff" size={12} fill="#fff" /> : null}
          <Text
            className="font-extrabold uppercase text-white"
            style={{ fontSize: 10, letterSpacing: 1.2 }}
          >
            {classProperLabel(classKey)}
          </Text>
        </View>
      </View>

      {/* QR — dark-on-white plate so it always scans */}
      <View className="mt-4 w-full items-center self-center" style={{ maxWidth: 212 }}>
        <View
          className="w-full items-center rounded-[22px] bg-white p-4"
          style={QR_PLATE_SHADOW}
        >
          <QRCode
            value={`mesita:${displayCode}`}
            size={180}
            backgroundColor="#ffffff"
            color="#2b1233"
            ecl="H"
            logo={require('../../../assets/expo.icon/Assets/mesita-mark.png')}
            logoSize={40}
            logoBackgroundColor="#ffffff"
            logoMargin={2}
            logoBorderRadius={8}
          />
        </View>
        <Pressable
          onPress={() => void onCopy()}
          accessibilityRole="button"
          accessibilityLabel={copied ? 'Code copied' : 'Copy code'}
          className="mt-3 w-full flex-row items-center justify-center gap-2 active:opacity-90"
        >
          <Text
            className="font-semibold text-white"
            style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 18,
              letterSpacing: 4,
              fontVariant: ['tabular-nums'],
            }}
          >
            {displayCode}
          </Text>
          {copied ? (
            <Check color="rgba(255,255,255,0.8)" size={16} />
          ) : (
            <Copy color="rgba(255,255,255,0.6)" size={16} />
          )}
        </Pressable>
      </View>

      <IdentityStrip
        displayName={displayName}
        classKey={classKey}
        origin={origin}
      />

      <IgChips
        igConnected={igConnected}
        instagramHandle={instagramHandle}
        followerCount={followerCount}
      />

      <Scorecard stats={s} />
    </LinearGradient>
  );
}
