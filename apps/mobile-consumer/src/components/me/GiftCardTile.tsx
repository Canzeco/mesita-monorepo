import { LinearGradient } from 'expo-linear-gradient';
import { Check, Mail, Share2, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import {
  Linking,
  Pressable,
  Share,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { GRADIENT_DIAGONAL, SHADOW_GLOW } from '@/constants/brand';
import { copyText } from '@/lib/clipboard';

const MESITA_CONTACT_EMAIL = 'support@mesita.ai';
export const DEFAULT_SHARE_URL = 'https://www.mesita.ai';

/** ISO/IEC 7810 ID-1 credit-card aspect (web GiftCardDeck parity). */
const CARD_ASPECT = 85.6 / 53.98;

export type GiftCard = {
  id: string;
  audience: string;
  line: string;
  colors: readonly [string, string];
  Icon: LucideIcon;
  share: { title: string; text: string; url?: string };
  contact?: { subject: string };
};

export function GiftCardTile({ card }: { card: GiftCard }) {
  const [flash, setFlash] = useState<null | 'shared' | 'copied'>(null);
  const Emblem = card.Icon;
  const contact = card.contact;
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 32, 390);
  const cardHeight = cardWidth / CARD_ASPECT;

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
        width: '100%',
        height: cardHeight,
        overflow: 'hidden',
        ...SHADOW_GLOW,
      }}
    >
      {/* Gloss sheen — web GiftCardDeck overlay peer. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 0.9 }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '55%',
        }}
        pointerEvents="none"
      />

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
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontWeight: '800',
            letterSpacing: 2,
            textTransform: 'uppercase',
            fontSize: 11,
          }}
        >
          Mesita · Gift card
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {contact ? (
            <PillButton
              icon={<Mail color="#fff" size={14} />}
              label="Contact"
              onPress={() =>
                void Linking.openURL(
                  `mailto:${MESITA_CONTACT_EMAIL}?subject=${encodeURIComponent(
                    contact.subject,
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
          className="font-display"
          style={{ color: '#fff', fontWeight: '700', fontSize: 22 }}
        >
          {card.audience}
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.85)',
            marginTop: 6,
            fontSize: 14,
          }}
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
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
        {label}
      </Text>
    </Pressable>
  );
}
