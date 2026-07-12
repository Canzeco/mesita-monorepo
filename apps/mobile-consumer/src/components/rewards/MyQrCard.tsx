import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Check,
  Copy,
  Crown,
  Flame,
  AtSign,
  Users,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';

import { formatCurrency } from '@/lib/api/pay';
import { displayConsumerCode } from '@/lib/consumer-code';
import type { RewardStats } from '@/lib/hooks/useConsumerPayTickets';
import { firstInitials, formatCompactCount } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

const ORIGIN_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  subscription: 'Subscription',
  invitation: 'Invite',
  default: 'Mesita',
};

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 4 }}>
      <Text
        style={{
          color: '#fff',
          fontSize: 18,
          fontWeight: '800',
          letterSpacing: -0.3,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          marginTop: 4,
          color: 'rgba(255,255,255,0.8)',
          fontSize: 8.5,
          fontWeight: '700',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

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
  const isPremium = consumerClass?.class === 'premium';
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
  const gradientColors = isPremium
    ? (['#ff7a45', '#ff3d73', '#a13cf0'] as const)
    : (['#ff7a45', '#ff4d6d', '#ff2d78'] as const);

  return (
    <LinearGradient
      colors={[...gradientColors]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={{
        borderRadius: 28,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 20,
        overflow: 'hidden',
        shadowColor: '#ff4d6d',
        shadowOpacity: 0.35,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 12 },
        elevation: 10,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 9,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Flame color="#fff" size={16} fill="#fff" />
          </View>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
            Mesita Card
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.22)',
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          {isPremium ? <Crown color="#fff" size={12} fill="#fff" /> : null}
          <Text
            style={{
              color: '#fff',
              fontSize: 10,
              fontWeight: '800',
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            {isPremium ? 'Premium' : 'Free'}
          </Text>
        </View>
      </View>

      <View style={{ alignItems: 'center', marginTop: 16, width: '100%' }}>
        <View
          style={{
            width: '100%',
            maxWidth: 212,
            borderRadius: 22,
            backgroundColor: '#fff',
            padding: 16,
            shadowColor: '#781428',
            shadowOpacity: 0.35,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 6,
            alignItems: 'center',
          }}
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
          accessibilityLabel={copied ? 'Code copied' : 'Copy code'}
          style={{
            marginTop: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Text
            style={{
              color: '#fff',
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

      <View
        style={{
          marginTop: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.22)',
          paddingTop: 16,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.18)',
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.3)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
            {firstInitials(displayName)}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}
          >
            {displayName}
          </Text>
          <View
            style={{
              marginTop: 2,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {isPremium ? (
              <>
                <Crown color="#fff" size={12} fill="#fff" />
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11 }}>
                  Premium · via {ORIGIN_LABEL[origin] ?? 'Mesita'}
                </Text>
              </>
            ) : (
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11 }}>
                Free member
              </Text>
            )}
          </View>
        </View>
      </View>

      {igConnected ? (
        <View
          style={{
            marginTop: 12,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {instagramHandle ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.17)',
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <AtSign color="#fff" size={14} />
              <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '600' }}>
                @{instagramHandle.replace(/^@/, '')}
              </Text>
            </View>
          ) : null}
          {followerCount > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.17)',
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Users color="#fff" size={14} />
              <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '600' }}>
                {formatCompactCount(followerCount)} followers
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View
        style={{
          marginTop: 16,
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.22)',
          paddingTop: 16,
        }}
      >
        <Stat value={String(s.visits)} label="Visits" />
        <Stat
          value={s.savedCents > 0 ? formatCurrency(s.savedCents) : '—'}
          label="Saved"
        />
        <Stat value={String(s.stories)} label="Stories" />
        <Stat value={String(s.reviews)} label="Reviews" />
      </View>
    </LinearGradient>
  );
}
