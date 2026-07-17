import { AtSign, Crown, Smile } from 'lucide-react-native';
import { Fragment } from 'react';
import { Linking, View } from 'react-native';

import {
  CLASSES,
  PREMIUM_SUBSCRIBE_URL,
} from '@/lib/consumer-classes';
import { useEffectiveClass } from '@/lib/mock-class';
import { useAuth } from '@/providers/auth';
import { ClimbCard, type ClimbCardData } from './ClimbCard';
import { InstagramConnectedSummary } from './InstagramConnectedSummary';

export function WaysToClimb({
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
