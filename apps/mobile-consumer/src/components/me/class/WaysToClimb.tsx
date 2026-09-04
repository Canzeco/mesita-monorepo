import { Fragment } from 'react';
import { Linking, View } from 'react-native';

import { GRADIENTS } from '@/constants/brand';
import {
  CLASSES,
  CLASS_ICONS,
  PREMIUM_SUBSCRIBE_URL,
} from '@/lib/consumer-classes';
import { useEffectiveClass } from '@/lib/mock-class';
import { toast } from '@/lib/toast';
import { useAuth } from '@/providers/auth';
import { ClimbCard, type ClimbCardData } from './ClimbCard';
import { InstagramConnectedSummary } from './InstagramConnectedSummary';

// Elevated classes share core perks; the meter carries the discount signal
// (MESITA-907 qualitative). Story Bonus is not a class perk — it lives on
// Instagram connect / Rewards (MESITA-909).
const ELEVATED_PERKS = [
  'Personalized picks',
  '10 reservations / mo',
];

export function WaysToClimb({
  onConnectInstagram,
}: {
  onConnectInstagram: () => void;
}) {
  const premium = CLASSES.find((c) => c.id === 'premium')!;
  const influencer = CLASSES.find((c) => c.id === 'influencer')!;
  const { consumerClass, profile } = useAuth();
  const { key: classKey, origin, followers } = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  const isStandard = classKey === 'standard';

  const cards: ClimbCardData[] = [
    {
      key: 'standard',
      icon: CLASS_ICONS.standard,
      iconColors: GRADIENTS.free,
      title: 'Bronze',
      via: 'Default',
      discountLevel: 'LOW',
      perks: ['Basic place picks', '2 AI reservations / mo'],
      reached: isStandard,
      reachedLabel: 'Current class',
      note: isStandard ? undefined : 'Included',
    },
    {
      key: 'influencer',
      icon: CLASS_ICONS.influencer,
      iconColors: GRADIENTS.influencer,
      title: 'Silver',
      via: 'Instagram',
      accent: true,
      door: `${influencer.followerThreshold.toLocaleString('en-US')}+ followers · automatic`,
      discountLevel: 'HIGH',
      perks: [...ELEVATED_PERKS],
      reached: classKey === 'influencer',
      reachedLabel: origin === 'instagram' ? 'Connected' : 'Active',
      action: { label: 'Join with Instagram', onPress: onConnectInstagram },
    },
    {
      key: 'premium',
      icon: CLASS_ICONS.premium,
      iconColors: GRADIENTS.premium,
      title: 'Gold',
      via: 'Subscription',
      accent: true,
      door: `$${premium.priceMxn} MXN / mo · cancel anytime`,
      discountLevel: 'EXTRA',
      perks: [...ELEVATED_PERKS],
      reached: classKey === 'premium',
      reachedLabel: 'Active',
      // Apple review: no Stripe checkout in-app — subscribe happens on web.
      action: {
        label: 'Subscribe on web',
        onPress: () => void Linking.openURL(PREMIUM_SUBSCRIBE_URL),
      },
    },
    {
      key: 'aura',
      icon: CLASS_ICONS.aura,
      iconColors: GRADIENTS.gold,
      title: 'Diamond',
      via: 'Invite',
      accent: true,
      door: 'Invitation only · no payment',
      discountLevel: 'MAX',
      perks: [...ELEVATED_PERKS],
      reached: classKey === 'aura',
      reachedLabel: 'Active',
      action: {
        label: 'Request invite',
        secondary: true,
        onPress: () =>
          toast(
            'Invitation requests open soon — Mesita curates Aura personally.',
          ),
      },
    },
  ];

  return (
    <View style={{ gap: 12 }}>
      {cards.map((c) => (
        <Fragment key={c.key}>
          <ClimbCard data={c} />
          {c.key === 'influencer' && origin === 'instagram' ? (
            <InstagramConnectedSummary followers={followers} />
          ) : null}
        </Fragment>
      ))}
    </View>
  );
}
