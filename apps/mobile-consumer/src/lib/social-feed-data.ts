// TODO(EF): social feed — parked mock (copied from web-consumer). When the
// social backend lands, swap SOCIAL_PEOPLE for an EF read. That EF MUST apply
// `_shared/consumer-privacy.ts` (MESITA-913): private accounts → Anonymous
// guest; story events omitted when privacy_show_stories=false.

import {
  Camera,
  Heart,
  MapPin,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';

import { COLORS } from '@/constants/brand';

type SocialActionKind = 'visit' | 'like' | 'reward' | 'story';

// THE FILL RANKS THE CHIP; THE GLYPH + LABEL NAME IT (MESITA-1954).
//
// These four kinds used to carry four hues — pink / rose / amber / fuchsia,
// each a 10% wash under a matching mid-chroma glyph. Four hues on four
// categories is chroma spent on hierarchy, which the rule takes. The washes
// are also stock Tailwind palette classes stored as DATA in a .ts file, so no
// token edit and no className sweep over .tsx ever reached them: left alone,
// the feed would still ship rose and amber under an achromatic app.
//
// Flattening all four to one tint is the failure web shipped three times, so
// `reward` — the money event, the one thing in this feed the guest gets back —
// takes the FILLED ink chip and the other three take the quiet muted one. That
// is the same rank ACTIVITY_KIND_META gives `earned` a tab away, so the money
// row looks like the money row in both feeds. Within the quiet three the kind
// was never carried by the hue anyway: social-activity-row renders a distinct
// lucide glyph (MapPin / Heart / Camera) AND prints meta.label as text beside
// it, which is the strongest carrier there is.
//
// `bg` stays a className (it is interpolated into the chip's class string) and
// `color` stays a hex (it is an inline icon + text colour), so the pair reads
// the same token layer through both of its halves.
export const SOCIAL_ACTION_META: Record<
  SocialActionKind,
  { label: string; Icon: LucideIcon; color: string; bg: string }
> = {
  visit: {
    label: 'Visit',
    Icon: MapPin,
    color: COLORS.foreground,
    bg: 'bg-muted',
  },
  like: {
    label: 'Like',
    Icon: Heart,
    color: COLORS.foreground,
    bg: 'bg-muted',
  },
  // The affirmative: the guest earned something.
  reward: {
    label: 'Reward',
    Icon: Sparkles,
    color: COLORS.primaryForeground,
    bg: 'bg-primary',
  },
  story: {
    label: 'Story',
    Icon: Camera,
    color: COLORS.foreground,
    bg: 'bg-muted',
  },
};

export type SocialPerson = {
  id: string;
  name: string;
  igHandle: string;
  plan: 'standard' | 'premium' | 'influencer';
  avatarUrl: string;
  action: SocialActionKind;
  placeSlot: number;
  fallbackPlaceName: string;
  time: string;
  minutesAgo: number;
  stats: { visits: number; likes: number; stories: number; rewards: number };
};

export function socialRelevance(p: SocialPerson): number {
  const { visits, likes, stories, rewards } = p.stats;
  const engagement = visits + likes * 2 + stories + rewards * 3;
  const mult = p.plan === 'influencer' ? 1.25 : p.plan === 'premium' ? 1.15 : 1;
  return Math.round(engagement * mult);
}

export const SOCIAL_PEOPLE: SocialPerson[] = [
  {
    id: 'sofi',
    name: 'Sofía Méndez',
    igHandle: '@sofi.mz',
    plan: 'influencer',
    avatarUrl: 'https://i.pravatar.cc/200?img=20',
    action: 'visit',
    placeSlot: 0,
    fallbackPlaceName: 'Casa Luminar',
    time: '2m',
    minutesAgo: 2,
    stats: { visits: 42, likes: 18, stories: 9, rewards: 7 },
  },
  {
    id: 'ana',
    name: 'Ana Sofía',
    igHandle: '@ana.sof',
    plan: 'standard',
    avatarUrl: 'https://i.pravatar.cc/200?img=47',
    action: 'story',
    placeSlot: 0,
    fallbackPlaceName: 'Casa Luminar',
    time: 'just now',
    minutesAgo: 0,
    stats: { visits: 11, likes: 23, stories: 14, rewards: 2 },
  },
  {
    id: 'pablo',
    name: 'Pablo Treviño',
    igHandle: '@pablo.tr',
    plan: 'premium',
    avatarUrl: 'https://i.pravatar.cc/200?img=33',
    action: 'like',
    placeSlot: 1,
    fallbackPlaceName: 'Neón Bar',
    time: '8m',
    minutesAgo: 8,
    stats: { visits: 35, likes: 61, stories: 4, rewards: 12 },
  },
  {
    id: 'diego',
    name: 'Diego R.',
    igHandle: '@diego.r',
    plan: 'standard',
    avatarUrl: 'https://i.pravatar.cc/200?img=12',
    action: 'story',
    placeSlot: 2,
    fallbackPlaceName: 'Mar Verde',
    time: '4m',
    minutesAgo: 4,
    stats: { visits: 8, likes: 15, stories: 22, rewards: 1 },
  },
  {
    id: 'mariana',
    name: 'Mariana',
    igHandle: '@mari.mx',
    plan: 'influencer',
    avatarUrl: 'https://i.pravatar.cc/200?img=32',
    action: 'reward',
    placeSlot: 0,
    fallbackPlaceName: 'Casa Luminar',
    time: '22m',
    minutesAgo: 22,
    stats: { visits: 57, likes: 30, stories: 6, rewards: 19 },
  },
  {
    id: 'luis',
    name: 'Luis P.',
    igHandle: '@luis.p',
    plan: 'standard',
    avatarUrl: 'https://i.pravatar.cc/200?img=53',
    action: 'visit',
    placeSlot: 2,
    fallbackPlaceName: 'Mar Verde',
    time: '28m',
    minutesAgo: 28,
    stats: { visits: 16, likes: 9, stories: 3, rewards: 4 },
  },
  {
    id: 'camila',
    name: 'Camila V.',
    igHandle: '@cami.v',
    plan: 'influencer',
    avatarUrl: 'https://i.pravatar.cc/200?img=23',
    action: 'like',
    placeSlot: 3,
    fallbackPlaceName: 'Atelier Nueve',
    time: '1h',
    minutesAgo: 60,
    stats: { visits: 28, likes: 44, stories: 11, rewards: 8 },
  },
  {
    id: 'tomas',
    name: 'Tomás G.',
    igHandle: '@tomas.g',
    plan: 'standard',
    avatarUrl: 'https://i.pravatar.cc/200?img=14',
    action: 'reward',
    placeSlot: 4,
    fallbackPlaceName: 'Ferment & Co',
    time: '1h',
    minutesAgo: 60,
    stats: { visits: 13, likes: 7, stories: 2, rewards: 5 },
  },
  {
    id: 'renata',
    name: 'Renata L.',
    igHandle: '@ren.lz',
    plan: 'standard',
    avatarUrl: 'https://i.pravatar.cc/200?img=49',
    action: 'story',
    placeSlot: 5,
    fallbackPlaceName: 'Panadería Sur',
    time: '4h',
    minutesAgo: 240,
    stats: { visits: 6, likes: 12, stories: 17, rewards: 1 },
  },
  {
    id: 'andres',
    name: 'Andrés C.',
    igHandle: '@andres.c',
    plan: 'influencer',
    avatarUrl: 'https://i.pravatar.cc/200?img=15',
    action: 'story',
    placeSlot: 6,
    fallbackPlaceName: 'Azul Club',
    time: '5h',
    minutesAgo: 300,
    stats: { visits: 49, likes: 26, stories: 31, rewards: 10 },
  },
  {
    id: 'mateo',
    name: 'Mateo V.',
    igHandle: '@mateo.v',
    plan: 'premium',
    avatarUrl: 'https://i.pravatar.cc/200?img=11',
    action: 'like',
    placeSlot: 3,
    fallbackPlaceName: 'Atelier Nueve',
    time: '6h',
    minutesAgo: 360,
    stats: { visits: 33, likes: 52, stories: 5, rewards: 14 },
  },
  {
    id: 'lucia',
    name: 'Lucía Garza',
    igHandle: '@lu.gza',
    plan: 'standard',
    avatarUrl: 'https://i.pravatar.cc/200?img=25',
    action: 'reward',
    placeSlot: 5,
    fallbackPlaceName: 'Panadería Sur',
    time: '8h',
    minutesAgo: 480,
    stats: { visits: 21, likes: 19, stories: 8, rewards: 6 },
  },
];
