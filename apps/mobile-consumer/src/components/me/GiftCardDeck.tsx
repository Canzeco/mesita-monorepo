import { LinearGradient } from 'expo-linear-gradient';
import {
  Briefcase,
  Check,
  Mail,
  Megaphone,
  Share2,
  Sparkles,
  UserPlus,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, Share, View } from 'react-native';
import { Text } from 'react-native-paper';

import { GRADIENT_DIAGONAL, SHADOW_GLOW } from '@/constants/brand';
import { copyText } from '@/lib/clipboard';

const MESITA_CONTACT_EMAIL = 'support@mesita.ai';
const DEFAULT_SHARE_URL = 'https://www.mesita.ai';

type GiftCard = {
  id: string;
  audience: string;
  line: string;
  colors: readonly [string, string];
  Icon: LucideIcon;
  share: { title: string; text: string; url?: string };
  contact?: { subject: string };
};

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

function GiftCardTile({ card }: { card: GiftCard }) {
  const [flash, setFlash] = useState<null | 'shared' | 'copied'>(null);
  const Emblem = card.Icon;

  const onShare = async () => {
    const url = card.share.url ?? DEFAULT_SHARE_URL;
    const message = `${card.share.text} ${url}`;
    try {
      const result = await Share.share({
        title: card.share.title,
        message,
        url,
      });
      if (result.action === Share.sharedAction) {
        setFlash('shared');
        setTimeout(() => setFlash(null), 1600);
        return;
      }
    } catch {
      // fall through to copy
    }
    try {
      const mode = await copyText(message);
      setFlash(mode === 'copied' ? 'copied' : 'shared');
      setTimeout(() => setFlash(null), 1600);
    } catch {
      // Clipboard unavailable — fail silently.
    }
  };

  return (
    <LinearGradient
      colors={[...card.colors]}
      start={GRADIENT_DIAGONAL.start}
      end={GRADIENT_DIAGONAL.end}
      style={{
        borderRadius: 16,
        padding: 20,
        minHeight: 168,
        overflow: 'hidden',
        ...SHADOW_GLOW,
      }}
    >
      <Emblem
        color="rgba(255,255,255,0.12)"
        size={112}
        strokeWidth={1.5}
        style={{ position: 'absolute', right: -12, bottom: -16 }}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <Text
          variant="labelSmall"
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontWeight: '800',
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          Mesita · Gift card
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {card.contact ? (
            <PillButton
              icon={<Mail color="#fff" size={14} />}
              label="Contact"
              onPress={() =>
                void Linking.openURL(
                  `mailto:${MESITA_CONTACT_EMAIL}?subject=${encodeURIComponent(
                    card.contact!.subject,
                  )}`,
                )
              }
            />
          ) : null}
          <PillButton
            icon={
              flash ? (
                <Check color="#fff" size={14} />
              ) : (
                <Share2 color="#fff" size={14} />
              )
            }
            label={
              flash === 'shared'
                ? 'Shared'
                : flash === 'copied'
                  ? 'Copied'
                  : 'Share'
            }
            onPress={() => void onShare()}
          />
        </View>
      </View>

      <View style={{ marginTop: 'auto', paddingTop: 24 }}>
        <Text
          variant="headlineSmall"
          style={{ color: '#fff', fontWeight: '700' }}
        >
          {card.audience}
        </Text>
        <Text
          variant="bodyMedium"
          style={{ color: 'rgba(255,255,255,0.85)', marginTop: 6 }}
        >
          {card.line}
        </Text>
      </View>
    </LinearGradient>
  );
}

function PillButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      {icon}
      <Text
        variant="labelMedium"
        style={{ color: '#fff', fontWeight: '700' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
