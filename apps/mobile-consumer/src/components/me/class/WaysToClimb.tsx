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
  const magnetic = CLASSES.find((c) => c.id === 'magnetic')!;
  const { consumerClass, profile } = useAuth();
  const { key, origin, followers } = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  const isStandard = key === 'standard';

  const cards: ClimbCardData[] = [
    {
      key: 'standard',
      icon: Smile,
      title: 'Standard',
      price: '$0',
      priceNote: 'always free',
      desc: 'Your default account at no cost. Get a base discount at Verified Partners, standard recommendations, and book up to 2 reservations every month.',
      reached: isStandard,
      reachedLabel: 'Current class',
      note: isStandard ? undefined : 'Included in every account',
    },
    {
      key: 'subscription',
      icon: Crown,
      title: 'Premium',
      via: 'Subscription',
      accent: true,
      price: `$${premium.priceMxn} MXN`,
      priceNote: 'per month · cancel anytime',
      desc: 'Subscribe and unlock full Premium instantly — boosted discounts, personalized recommendations, and unlimited reservations. No follower count needed; cancel whenever you want. Manage on web from this app.',
      reached: origin === 'subscription',
      reachedLabel: 'Active',
      action: {
        label: 'Subscribe on web',
        onPress: () => void Linking.openURL(PREMIUM_SUBSCRIBE_URL),
      },
    },
    {
      key: 'instagram',
      icon: AtSign,
      igGradient: true,
      title: 'Magnetic',
      via: 'Instagram',
      accent: true,
      price: `${magnetic.followerThreshold.toLocaleString('en-US')}+ followers`,
      priceNote: 'no payment — earned with reach',
      desc: "Connect an Instagram with 1,000+ followers and post a story each time you visit. You unlock Magnetic — Mesita's top, invite-only tier — with the biggest discounts, personalized recommendations, and unlimited reservations, without paying a peso.",
      reached: origin === 'instagram',
      reachedLabel: 'Connected',
      action: { label: 'Connect', onPress: onConnectInstagram },
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
