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

export type ActivityKind =
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

export const ACTIVITY_KIND_META: Record<
  ActivityKind,
  { Icon: LucideIcon; bg: string; color: string }
> = {
  earned: { Icon: Coins, bg: 'rgba(236,72,153,0.10)', color: '#db2777' },
  saved: { Icon: Bookmark, bg: 'rgba(245,158,11,0.10)', color: '#d97706' },
  booked: {
    Icon: CalendarCheck,
    bg: 'rgba(16,185,129,0.10)',
    color: '#059669',
  },
  upgraded: { Icon: Crown, bg: 'rgba(139,92,246,0.10)', color: '#7c3aed' },
  swiped: { Icon: Heart, bg: 'rgba(244,63,94,0.10)', color: '#e11d48' },
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
    verb: 'You unlocked a reward at',
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
    verb: 'unlocked a reward at',
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
