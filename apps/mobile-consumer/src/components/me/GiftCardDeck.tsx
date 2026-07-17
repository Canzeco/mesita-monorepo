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

const CARDS: GiftCard[] = [
  {
    id: 'consumers',
    audience: 'Invite a friend',
    line: 'Your seat at the table.',
    colors: ['#ff5aab', '#ec006c'],
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
    colors: ['#fbbf24', '#f97316'],
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
    colors: ['#d946ef', '#9333ea'],
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
    colors: ['#38bdf8', '#2563eb'],
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
    colors: ['#404040', '#0a0a0a'],
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
