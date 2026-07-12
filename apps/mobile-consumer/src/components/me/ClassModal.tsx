import { LinearGradient } from 'expo-linear-gradient';
import {
  AtSign,
  BadgeCheck,
  Check,
  Crown,
  Smile,
  type LucideIcon,
} from 'lucide-react-native';
import { Fragment, type ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import {
  CLASSES,
  PREMIUM_SUBSCRIBE_URL,
} from '@/lib/consumer-classes';
import {
  useEffectiveClass,
  useMockClass,
  type MockClass,
} from '@/lib/mock-class';
import { useAuth } from '@/providers/auth';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConnectInstagram: () => void;
};

const COMPARE_ROWS = [
  { label: 'Discounts', free: 'Base', premium: 'Boosted' },
  { label: 'Recommendations', free: 'Standard', premium: 'Personalized' },
  { label: 'Max monthly reservations', free: '2', premium: 'Unlimited' },
];

export function ClassModal({
  visible,
  onClose,
  onConnectInstagram,
}: Props) {
  return (
    <FullScreenSheet
      visible={visible}
      onClose={onClose}
      title="Your class"
      subtitle="Free or Premium — and how to climb"
    >
      <ClassPreviewToggle />
      <SectionEyebrow>Current class</SectionEyebrow>
      <CurrentClassCard />
      <SectionEyebrow>Comparison</SectionEyebrow>
      <FreeVsPremium />
      <SectionEyebrow>Classes</SectionEyebrow>
      <WaysToClimb onConnectInstagram={onConnectInstagram} />
    </FullScreenSheet>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        color: 'rgba(38,4,9,0.55)',
        letterSpacing: 1.6,
        textTransform: 'uppercase',
        fontWeight: '700',
      }}
    >
      {children}
    </Text>
  );
}

function ClassPreviewToggle() {
  const [override, setOverride] = useMockClass();
  const { consumerClass, profile } = useAuth();
  const effective = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  const selected: MockClass =
    override ??
    (effective.key === 'free'
      ? 'free'
      : effective.origin === 'instagram'
        ? 'instagram'
        : 'subscription');

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
        <Text style={{ color: '#775254' }}>
          Preview class state
        </Text>
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
            { value: 'free', label: 'Free' },
            { value: 'subscription', label: 'Sub' },
            { value: 'instagram', label: 'IG' },
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
                style={{
                  fontWeight: '600',
                  fontSize: 13,
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

function CurrentClassCard() {
  const { consumerClass, profile } = useAuth();
  const { key, origin } = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  const meta = CLASSES.find((c) => c.id === key)!;
  const isPremium = key === 'premium';
  const Icon =
    !isPremium ? Smile : origin === 'instagram' ? AtSign : Crown;
  const via =
    !isPremium
      ? null
      : origin === 'instagram'
        ? 'via Instagram'
        : origin === 'subscription'
          ? 'via subscription'
          : origin === 'invitation'
            ? 'via invitation'
            : null;

  return (
    <LinearGradient
      colors={isPremium ? [...GRADIENTS.premium] : [...GRADIENTS.free]}
      start={GRADIENT_DIAGONAL.start}
      end={GRADIENT_DIAGONAL.end}
      style={{
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: isPremium
            ? 'rgba(255,255,255,0.2)'
            : 'rgba(38,4,9,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon color={isPremium ? '#fff' : '#260409'} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: isPremium ? '#fff' : '#260409',
            fontWeight: '700',
          }}
        >
          Mesita {meta.label}
        </Text>
        {via ? (
          <Text
            style={{ color: isPremium ? 'rgba(255,255,255,0.9)' : '#775254' }}
          >
            {via}
          </Text>
        ) : null}
      </View>
    </LinearGradient>
  );
}

function FreeVsPremium() {
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

type ClimbCardData = {
  key: string;
  icon: LucideIcon;
  title: string;
  via?: string;
  accent?: boolean;
  price: string;
  priceNote?: string;
  desc: string;
  reached: boolean;
  reachedLabel: string;
  action?: { label: string; onPress: () => void };
  note?: string;
  igGradient?: boolean;
};

function WaysToClimb({
  onConnectInstagram,
}: {
  onConnectInstagram: () => void;
}) {
  const premium = CLASSES.find((c) => c.id === 'premium')!;
  const { consumerClass, profile } = useAuth();
  const { key, origin, followers } = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  const isFree = key === 'free';

  const cards: ClimbCardData[] = [
    {
      key: 'free',
      icon: Smile,
      title: 'Free',
      price: '$0',
      priceNote: 'always free',
      desc: 'Your default account at no cost. Get a base discount at Verified Partners, standard recommendations, and book up to 2 reservations every month.',
      reached: isFree,
      reachedLabel: 'Current class',
      note: isFree ? undefined : 'Included in every account',
    },
    {
      key: 'instagram',
      icon: AtSign,
      igGradient: true,
      title: 'Premium',
      via: 'Instagram',
      accent: true,
      price: `${premium.followerThreshold.toLocaleString('en-US')}+ followers`,
      priceNote: 'no payment — earned with reach',
      desc: 'Connect an Instagram with 1,000+ followers and post a story each time you visit. You get full Premium — boosted discounts, personalized recommendations, and unlimited reservations — without paying a peso.',
      reached: origin === 'instagram',
      reachedLabel: 'Connected',
      action: { label: 'Connect', onPress: onConnectInstagram },
    },
    {
      key: 'subscription',
      icon: Crown,
      title: 'Premium',
      via: 'Subscription',
      accent: true,
      price: `$${premium.priceMxn} MXN`,
      priceNote: 'per month · cancel anytime',
      desc: 'Subscribe on the web to unlock full Premium instantly — boosted discounts, personalized recommendations, and unlimited reservations. No follower count needed; cancel whenever you want.',
      reached: origin === 'subscription',
      reachedLabel: 'Active',
      action: {
        label: 'Subscribe on web',
        onPress: () => void Linking.openURL(PREMIUM_SUBSCRIBE_URL),
      },
    },
  ];

  return (
    <View style={{ gap: 12 }}>
      {cards.map((c) => (
        <Fragment key={c.key}>
          <ClimbCard data={c} />
          {c.key === 'instagram' && origin === 'instagram' ? (
            <InstagramConnectedSummary followers={followers} />
          ) : null}
        </Fragment>
      ))}
    </View>
  );
}

function InstagramConnectedSummary({ followers }: { followers: number }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.25)',
        backgroundColor: 'rgba(16,185,129,0.05)',
        padding: 16,
      }}
    >
      <LinearGradient
        colors={['#f58529', '#dd2a7b', '#8134af']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AtSign color="#fff" size={20} />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontWeight: '700' }}>
            Profile connected
          </Text>
          <BadgeCheck color="#059669" size={16} />
        </View>
        <Text style={{ color: '#775254', marginTop: 4 }}>
          {followers > 0
            ? `${followers.toLocaleString('en-US')} followers · Premium active`
            : 'Premium active'}
        </Text>
        <Text
          style={{ color: 'rgba(119,82,84,0.8)', marginTop: 2 }}
        >
          Post a story each visit to keep Premium.
        </Text>
      </View>
    </View>
  );
}

function ClimbCard({ data }: { data: ClimbCardData }) {
  const Icon = data.icon;
  let footer: ReactNode = null;
  if (data.reached) {
    footer = (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          borderRadius: 10,
          backgroundColor: 'rgba(16,185,129,0.15)',
          paddingVertical: 10,
        }}
      >
        <Check color="#047857" size={14} strokeWidth={3} />
        <Text
          style={{ color: '#047857', fontWeight: '700' }}
        >
          {data.reachedLabel}
        </Text>
      </View>
    );
  } else if (data.action) {
    footer = (
      <Button onPress={data.action.onPress} accessibilityLabel={data.action.label}>
        {data.action.label}
      </Button>
    );
  } else if (data.note) {
    footer = (
      <View
        style={{
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#ebd9db',
          backgroundColor: '#faeff0',
          paddingVertical: 10,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#775254' }}>
          {data.note}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: data.accent ? 'rgba(139,108,232,0.3)' : '#ebd9db',
        backgroundColor: data.accent
          ? 'rgba(139,108,232,0.03)'
          : '#ffffff',
        padding: 20,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {data.igGradient ? (
          <LinearGradient
            colors={['#f58529', '#dd2a7b', '#8134af']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon color="#fff" size={24} />
          </LinearGradient>
        ) : (
          <LinearGradient
            colors={
              data.accent
                ? [...GRADIENTS.pink]
                : (['#faeff0', '#faeff0'] as const)
            }
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon color={data.accent ? '#fff' : '#260409'} size={24} />
          </LinearGradient>
        )}
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {data.accent ? (
              <Crown color="#6d4fd8" size={16} fill="#6d4fd8" />
            ) : null}
            <Text
              style={{
                fontWeight: '700',
                color: data.accent ? '#6d4fd8' : '#260409',
              }}
            >
              {data.title}
            </Text>
            {data.via ? (
              <Text style={{ color: '#775254' }}>
                via {data.via}
              </Text>
            ) : null}
          </View>
          <Text
            style={{ fontWeight: '700', marginTop: 8 }}
          >
            {data.price}
          </Text>
          {data.priceNote ? (
            <Text
              style={{ color: '#775254', marginTop: 2 }}
            >
              {data.priceNote}
            </Text>
          ) : null}
        </View>
      </View>
      <Text
        style={{ color: '#775254', marginTop: 16, lineHeight: 18 }}
      >
        {data.desc}
      </Text>
      {footer ? <View style={{ marginTop: 16 }}>{footer}</View> : null}
    </View>
  );
}
