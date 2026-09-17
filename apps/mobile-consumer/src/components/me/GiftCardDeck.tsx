import {
  Briefcase,
  Megaphone,
  Sparkles,
  UserPlus,
  UtensilsCrossed,
} from 'lucide-react-native';
import { View } from 'react-native';

import {
  DEFAULT_SHARE_URL,
  GiftCardTile,
  type GiftCard,
} from '@/components/me/GiftCardTile';

// THE DECK BECOMES A LADDER (MESITA-1954). The five cards had a rainbow — pink,
// amber, violet, sky, ink — and the full-bleed gradient is the card's whole
// identity: no border, no header, no divider between them. Desaturated as-is,
// consumers/influencers/agencies all land near L*45 and stack as three
// identical mid-grey rectangles. So the audiences are re-separated by WEIGHT:
// five ink steps ~7 L* apart, deepest first, descending the page. Every stop
// stays dark enough for GiftCardTile's white text — the lightest (#636363,
// L*42) still clears 4.5:1 under the rgba(255,255,255,0.8) header, which is the
// ceiling on this ladder. Do not collapse these five back to one value.
const CARDS: GiftCard[] = [
  {
    id: 'consumers',
    audience: 'Invite a friend',
    line: 'Your seat at the table.',
    // Step 1 of 5 — deepest ink. The everyday invite, the one card that most
    // wants pressing.
    colors: ['#1f1f1f', '#0a0a0a'],
    Icon: UserPlus,
    share: {
      title: 'Come join me on Mesita',
      text: 'Join me on Mesita — your seat at the table.',
    },
  },
  {
    id: 'businesses',
    audience: 'Know a restaurant or bar?',
    line: 'Refer it, or run one — setup takes ~8 minutes.',
    // Step 2 of 5.
    colors: ['#333333', '#171717'],
    Icon: UtensilsCrossed,
    share: {
      title: 'Mesita for restaurants',
      text: "I think you'd love Mesita — setup is ~8 min and free to start.",
      url: DEFAULT_SHARE_URL,
    },
    contact: { subject: 'Mesita for restaurants & bars' },
  },
  {
    id: 'influencers',
    audience: 'An influencer, or know one?',
    line: "20% of Mesita's equity is reserved for influencers.",
    // Step 3 of 5.
    colors: ['#454545', '#282828'],
    Icon: Megaphone,
    share: {
      title: 'Mesita for influencers',
      text: 'Mesita reserves 20% of its equity for influencers — you should partner with them.',
      url: DEFAULT_SHARE_URL,
    },
    contact: { subject: 'Mesita for influencers' },
  },
  {
    id: 'agencies',
    audience: 'Know a marketing agency?',
    line: 'Refer one, or run one — add Mesita to the stack.',
    // Step 4 of 5.
    colors: ['#545454', '#383838'],
    Icon: Briefcase,
    share: {
      title: 'Mesita for marketing agencies',
      text: 'If you run marketing for restaurants or bars, Mesita is worth adding to your stack.',
      url: DEFAULT_SHARE_URL,
    },
    contact: { subject: 'Mesita for marketing agencies' },
  },
  {
    id: 'models',
    audience: 'Know a talent agency?',
    line: 'Their talent goes Mesita Premium — free, no tricks.',
    // Step 5 of 5 — the lightest the white text tolerates. This card used to be
    // the only dark one; it is now the shallowest, so the ladder runs one way.
    colors: ['#636363', '#474747'],
    Icon: Sparkles,
    share: {
      title: 'Mesita for talent agencies',
      text: 'Mesita makes your talent Premium for free — partner places want them in the room.',
      url: DEFAULT_SHARE_URL,
    },
    contact: { subject: 'Mesita for model & talent agencies' },
  },
];

export function GiftCardDeck() {
  return (
    <View style={{ gap: 12 }}>
      {CARDS.map((card) => (
        <GiftCardTile key={card.id} card={card} />
      ))}
    </View>
  );
}
