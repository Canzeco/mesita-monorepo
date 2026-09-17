// Parked mock activity feed — ported from web-consumer consumer-activity-data.
// Swap for an EF when a real activity feed lands.

import {
  Bookmark,
  CalendarCheck,
  Coins,
  Crown,
  Heart,
  type LucideIcon,
} from 'lucide-react-native';

import { COLORS } from '@/constants/brand';

type ActivityKind =
  | 'earned'
  | 'saved'
  | 'booked'
  | 'upgraded'
  | 'swiped';

export type ConsumerActivity = {
  id: string;
  kind: ActivityKind;
  /** Visible only on the global feed. Omit for private items. */
  handle?: string;
  verb: string;
  place?: string;
  when: string;
};

// THE TILE RANKS THE ROW; THE GLYPH NAMES IT (MESITA-1954).
//
// This map used to hand each kind its own hue — pink / amber / emerald /
// violet / rose, each a 10% wash under a matching mid-chroma glyph. Five hues
// on five categories is chroma spent on hierarchy, which the rule takes.
//
// A blanket greyscale would have made all five tiles the SAME disc, and that
// is the failure web shipped three times. What actually carried the kind was
// never the hue: ConsumerActivityList renders no kind label, but it renders a
// distinct lucide glyph (Coins / Bookmark / CalendarCheck / Crown / Heart) and
// a verb that says the kind out loud. So the glyph keeps the kind, and the one
// thing the hues also encoded — that `earned`, the money row, is the row your
// eye lands on — is re-separated by WEIGHT instead of by a second grey: earned
// wears the filled ink tile, the other four wear the quiet muted tile. Ink on
// white vs #efefef is a rank you can see at 36px; two greys would not be.
//
// `upgraded` is deliberately NOT reserved. The class ladder keeps its hue
// where the product NAMES a tier — a Class badge, a plan chip. This is the
// generic `upgraded` activity kind, and its old #7c3aed matched neither
// tier.premium nor GRADIENTS.premium; it was off-token violet on a category.
// Binding it to tier.premium (#32191b) would render as near-#171717 at 16px
// anyway, so it would buy a distinction nobody could see. The Crown glyph and
// the words "Mesita Premium" in the row carry it.
export const ACTIVITY_KIND_META: Record<
  ActivityKind,
  { Icon: LucideIcon; bg: string; color: string }
> = {
  // The affirmative: money came back to the guest. Filled ink, inverted glyph.
  earned: {
    Icon: Coins,
    bg: COLORS.primary,
    color: COLORS.primaryForeground,
  },
  saved: { Icon: Bookmark, bg: COLORS.muted, color: COLORS.foreground },
  booked: {
    Icon: CalendarCheck,
    bg: COLORS.muted,
    color: COLORS.foreground,
  },
  upgraded: { Icon: Crown, bg: COLORS.muted, color: COLORS.foreground },
  swiped: { Icon: Heart, bg: COLORS.muted, color: COLORS.foreground },
};

export const MY_ACTIVITY: ConsumerActivity[] = [
  {
    id: 'm1',
    kind: 'earned',
    verb: 'You saved MX$340 with your discount at',
    place: 'Casa Luminar',
    when: 'yesterday',
  },
  {
    id: 'm2',
    kind: 'booked',
    verb: 'You booked a table at',
    place: 'Neón Bar',
    when: '2 days ago',
  },
  {
    id: 'm3',
    kind: 'saved',
    verb: 'You saved',
    place: 'Mar Verde',
    when: '3 days ago',
  },
  {
    id: 'm4',
    kind: 'upgraded',
    verb: 'You upgraded to',
    place: 'Mesita Premium',
    when: '1 week ago',
  },
];

export const GLOBAL_ACTIVITY: ConsumerActivity[] = [
  {
    id: 'l1',
    kind: 'earned',
    handle: '@maria',
    verb: 'saved MX$120 with a discount at',
    place: 'Mar Verde',
    when: '2 min ago',
  },
  {
    id: 'l2',
    kind: 'booked',
    handle: '@carlos',
    verb: 'booked a table at',
    place: 'Neón Bar',
    when: '5 min ago',
  },
  {
    id: 'l3',
    kind: 'upgraded',
    handle: '@sofia',
    verb: 'just upgraded to',
    place: 'Mesita Premium',
    when: '8 min ago',
  },
  {
    id: 'l4',
    kind: 'saved',
    handle: '@diego',
    verb: 'saved',
    place: 'Casa Luminar',
    when: '12 min ago',
  },
  {
    id: 'l5',
    kind: 'earned',
    handle: '@lucia',
    verb: 'saved MX$340 with a discount at',
    place: 'Atelier Nueve',
    when: '18 min ago',
  },
  {
    id: 'l6',
    kind: 'swiped',
    handle: '@pat',
    verb: 'swiped right on',
    place: 'Ferment & Co',
    when: '24 min ago',
  },
];
