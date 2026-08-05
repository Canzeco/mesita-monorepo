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

// Every elevated class (Influencer / Premium / Aura) shares ONE core perk set —
// they differ in the door (reach / paid / invited) and in how their money is
// made (the Story action vs flat rate vs the highest flat rate). Keep the
// shared lines a single constant so the cards can never drift apart. Perk
// wording echoes ClassComparison qualitative levels (MESITA-906) — no % or
// counts in benefit bullets.
const ELEVATED_PERKS = [
  'HIGH places recommendations',
  'HIGH AI-booked reservations',
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
      title: 'Standard',
      price: '$0',
      priceNote: 'always free',
      desc: 'Your default account at no cost — every guest starts here.',
      perks: [
        'LOW discount rewards at Verified Partners',
        'LOW places recommendations',
        'LOW AI-booked reservations',
      ],
      reached: isStandard,
      reachedLabel: 'Current class',
      note: isStandard ? undefined : 'Included in every account',
    },
    {
      key: 'influencer',
      icon: CLASS_ICONS.influencer,
      iconColors: GRADIENTS.sky,
      title: 'Influencer',
      via: 'Instagram',
      accent: true,
      price: `${influencer.followerThreshold.toLocaleString('en-US')}+ followers`,
      priceNote: 'no payment — earned with reach, automatic',
      // The Influencer class's real money is per-post: the Instagram Story
      // action is EXCLUSIVE to this class (segments v6) and pays the story
      // rung on any visit where a tagged story is verified. No % in Class
      // detail copy (MESITA-906) — Story exclusivity is the message.
      desc: `Connect an Instagram with ${influencer.followerThreshold.toLocaleString('en-US')}+ followers. The Instagram Story reward is yours alone — post a tagged story on any visit for an exclusive bonus.`,
      perks: [
        'HIGH discount rewards',
        'Instagram Story bonus — exclusive to Influencers',
        ...ELEVATED_PERKS,
      ],
      reached: classKey === 'influencer',
      reachedLabel: origin === 'instagram' ? 'Connected' : 'Active',
      action: { label: 'Join with Instagram', onPress: onConnectInstagram },
    },
    {
      key: 'premium',
      icon: CLASS_ICONS.premium,
      title: 'Premium',
      via: 'Subscription',
      accent: true,
      price: `$${premium.priceMxn} MXN`,
      priceNote: 'per month · cancel anytime',
      desc: 'Subscribe and unlock full Premium instantly. No follower count needed; cancel whenever you want. Manage on web from this app.',
      perks: [
        'EXTRA discount rewards',
        ...ELEVATED_PERKS,
      ],
      reached: classKey === 'premium',
      reachedLabel: 'Active',
      action: {
        label: 'Subscribe on web',
        onPress: () => void Linking.openURL(PREMIUM_SUBSCRIBE_URL),
      },
    },
    {
      key: 'aura',
      icon: CLASS_ICONS.aura,
      iconColors: GRADIENTS.gold,
      title: 'Aura',
      via: 'Invitation',
      accent: true,
      price: 'By invitation only',
      priceNote: 'no payment — Mesita curates Aura personally',
      // Aura is the presence class: the highest flat rate, paid for showing
      // up. No follower count, no posting — the invite is the whole door.
      // Qualitative MAX (MESITA-906) — no % in Class detail copy.
      desc: "Mesita's invite-only class. MAX discount rewards on every visit — just for being you. No followers required, nothing to post.",
      perks: [
        'MAX discount rewards — the highest of any class',
        ...ELEVATED_PERKS,
      ],
      reached: classKey === 'aura',
      reachedLabel: 'Active',
      // No invite-code or request flow exists yet — placeholder until the
      // curation door gets a consumer-side backend (grants are admin-console
      // only for launch).
      action: {
        label: 'Request invitation',
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
