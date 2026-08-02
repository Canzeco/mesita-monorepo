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
      desc: 'Subscribe and unlock full Premium instantly — boosted discounts, personalized recommendations, and 10 reservations a month. No follower count needed; cancel whenever you want. Manage on web from this app.',
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
      // Magnetic's discount is unconditional — the class rung pays on every
      // bill. A story is a separate, optional rung any class can take, never a
      // Magnetic requirement. Threshold reads off the DB-mirrored constant.
      desc: `Connect an Instagram with ${magnetic.followerThreshold.toLocaleString('en-US')}+ followers to unlock Magnetic — Mesita's top, invite-only tier — with boosted discounts, personalized recommendations, and 10 reservations a month, without paying a peso. Your discount applies every visit; no story required.`,
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
