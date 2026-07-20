import { LinearGradient } from 'expo-linear-gradient';
import { Check, Mail, Share2, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, Share, Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, SHADOW_GLOW } from '@/constants/brand';
import { copyText } from '@/lib/clipboard';

const MESITA_CONTACT_EMAIL = 'support@mesita.ai';
export const DEFAULT_SHARE_URL = 'https://www.mesita.ai';

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
        // Credit-card proportions (ISO/IEC 7810 ID-1, 85.6×53.98) — web parity.
        aspectRatio: 85.6 / 53.98,
        overflow: 'hidden',
        ...SHADOW_GLOW,
      }}
    >
      {/* Gift-card gloss: a soft diagonal sheen across the gradient, bottom-left
          → top-right (web `bg-gradient-to-tr from-transparent via-white/5
          to-white/20`). Sits above the gradient, below emblem + content. */}
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.2)']}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <Emblem
        color="rgba(255,255,255,0.1)"
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
          style={{ color: '#fff', fontWeight: '700' }}
        >
          {card.audience}
        </Text>
        <Text
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
        style={{ color: '#fff', fontWeight: '700' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
