import { LinearGradient } from 'expo-linear-gradient';
import { Check, Lock } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { COLORS, GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { CLASSES, CLASS_ICONS } from '@/lib/consumer-classes';
import { useEffectiveClass } from '@/lib/mock-class';
import { useAuth } from '@/providers/auth';

// The class rail (MESITA-972) — web ClassRail parity. An at-a-glance strip of
// all four classes in canonical ladder order (Standard → Influencer →
// Premium → Aura) showing which DOORS the signed-in consumer holds open: the
// one that currently wins the slot, the ones unlocked underneath it (a paying
// Aura member keeps the Premium chip unlocked — the subscription runs on),
// and the locked ones with the one-word how. Pure state: the ladder is
// strictly increasing, so there is nothing to switch.

const DOOR_HOW: Record<string, string> = {
  standard: 'Base',
  influencer: '2,000+ IG',
  premium: '$50/mo',
  aura: 'Invite',
};

// THE CLASS LADDER KEEPS ITS HUE (MESITA-1954): a tier the product names out
// loud to the guest is one of the three things chroma survives for, and this
// rail is the one place all four sit side by side — grey them and the strip
// says nothing. The metals converged on web's in the token layer, so the
// hues these tokens now carry are gold / diamond blue / ink / grey, not the
// old gold / red / blue / blue-grey.
// (MESITA-929 identity set, same source as CurrentClassCard.)
const CHIP_GRADIENTS = {
  standard: GRADIENTS.free,
  influencer: GRADIENTS.influencer,
  premium: GRADIENTS.premium,
  aura: GRADIENTS.gold,
} as const;

export function ClassRail() {
  const { consumerClass, profile } = useAuth();
  const { key, doors } = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );

  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {CLASSES.map((c) => {
        const Icon = CLASS_ICONS[c.id];
        const current = key === c.id;
        // Standard is a door every account holds open.
        const unlocked =
          current || c.id === 'standard' || doors[c.id as keyof typeof doors];
        const onDark = current && c.id !== 'standard';
        // Three chip states, and colour used to be the whole story: blue
        // "Unlocked", muted "Locked", white on the class gradient for the one
        // you hold. Ink cannot say that three times, so the glyph does —
        // Check vs Lock — with weight and case behind it (800 uppercase for
        // the affirmative against the door price's plain 400) and the chip
        // fill behind that. The locked icon keeps its LIGHTNESS (#a98a8d is
        // L*62, so #949494); dropping it onto the muted token would have
        // walked it UP towards the unlocked ink and closed the gap.
        const body = (
          <>
            <Icon
              size={16}
              color={onDark ? '#fff' : unlocked ? COLORS.foreground : '#949494'}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: onDark
                  ? '#fff'
                  : unlocked
                    ? COLORS.foreground
                    : COLORS.mutedForeground,
              }}
            >
              {c.label}
            </Text>
            {current ? (
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: '800',
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: onDark ? 'rgba(255,255,255,0.9)' : COLORS.foreground,
                }}
              >
                Current
              </Text>
            ) : unlocked ? (
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
              >
                <Check size={10} color={COLORS.foreground} />
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: '800',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: COLORS.foreground,
                  }}
                >
                  Unlocked
                </Text>
              </View>
            ) : (
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
              >
                <Lock size={10} color={COLORS.mutedForeground} />
                <Text style={{ fontSize: 9, color: COLORS.mutedForeground }}>
                  {DOOR_HOW[c.id]}
                </Text>
              </View>
            )}
          </>
        );
        const chipStyle = {
          flex: 1,
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 4,
          alignItems: 'center' as const,
          gap: 4,
        };
        return current ? (
          <LinearGradient
            key={c.id}
            colors={[...CHIP_GRADIENTS[c.id]]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={chipStyle}
          >
            {body}
          </LinearGradient>
        ) : (
          <View
            key={c.id}
            style={{
              ...chipStyle,
              // The locked chip cannot take COLORS.muted: this rail sits
              // straight on the sheet's background, and muted is now that
              // same value — the chip would vanish into the page instead of
              // reading as quiet. One step below the page keeps the old
              // page-over-chip relationship, so locked stays a box while
              // unlocked stays the outlined white card.
              backgroundColor: unlocked ? COLORS.card : '#e5e5e5',
              borderWidth: unlocked ? 1 : 0,
              borderColor: COLORS.border,
            }}
          >
            {body}
          </View>
        );
      })}
    </View>
  );
}
