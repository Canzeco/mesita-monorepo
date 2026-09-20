import { BadgeCheck, ChevronRight, CircleHelp, Clock, Tags } from 'lucide-react-native';
import { Linking, Pressable, Text, View } from 'react-native';

import { COLORS } from '@/constants/brand';
import type { PlaceDetail } from '@/lib/types/place-detail';
import { FACET_TINT } from '../place-detail-links';
import { Box } from './shared';

export function TagsBox({ place }: { place: PlaceDetail }) {
  if (place.tags.length === 0) return null;
  return (
    <Box title="Tags" icon={Tags} iconColor={COLORS.mutedForeground}>
      <View className="flex-row flex-wrap gap-2">
        {place.tags.map((t) => {
          const tint = FACET_TINT[t.facet] ?? {
            bg: COLORS.muted,
            text: COLORS.foreground,
            border: COLORS.border,
            dot: COLORS.mutedForeground,
          };
          return (
            <View
              key={t.slug}
              className="flex-row items-center gap-1.5 rounded-full border px-3 py-1.5"
              style={{
                backgroundColor: tint.bg,
                borderColor: tint.border,
              }}
            >
              <View
                className="size-1.5 rounded-full"
                style={{ backgroundColor: tint.dot }}
              />
              <Text
                className="text-xs font-semibold"
                style={{ color: tint.text }}
              >
                {t.label}
              </Text>
            </View>
          );
        })}
      </View>
    </Box>
  );
}

// THREE TONES, TWO DIFFERENT LAWS NOW. MESITA-1954 achromatized all three —
// sky for "Mesita Partner", amber for an unclaimed "Web listing", slate for
// Created/Updated dates — because in hue alone they were three near-identical
// lightnesses, and greyed in place they would have rendered as one
// interchangeable chip: a status claim and a timestamp reading as peers.
// MESITA-2031 (Pato, merged after, "verified icon... but RED") reversed that
// for Partner specifically: it is now RESERVED chroma, the same clause the
// Class metals ride — a tier the product names out loud. `amber` and `slate`
// were never touched by that decision and stay under the original achromatic
// re-separation, on FILL and WEIGHT rather than a second and third hue:
//   partner — RESERVED (MESITA-2031): tinted from --partner, the one status
//             this app now colours on purpose.
//   amber   — a real state nobody must act on (Web listing): hairline pill,
//             hollow dot. Renamed in intent, not in key, from web's `amber`.
//   slate   — metadata, not status (Created / Updated): muted fill, no
//             visible hairline, muted label.
const PILL_TONES = {
  // MESITA-2031: the partner row was `sky` — the last of the four colours
  // this one fact wore. Tinted from `--partner` (#d41f37); `text` is
  // pink-800-dark enough to clear AA on its own wash. A filled dot, like the
  // achromatic `solid` tone it replaced.
  partner: {
    bg: '#fef2f3',
    text: '#9f1626',
    border: '#f8ccd1',
    dot: COLORS.partner,
    dotBorder: 'transparent',
    hollowDot: false,
  },
  amber: {
    bg: COLORS.card,
    text: COLORS.foreground,
    border: COLORS.border,
    dot: 'transparent',
    dotBorder: COLORS.foreground,
    hollowDot: true,
  },
  slate: {
    bg: COLORS.muted,
    text: COLORS.mutedForeground,
    border: COLORS.muted,
    dot: COLORS.mutedForeground,
    dotBorder: 'transparent',
    hollowDot: false,
  },
} as const;

function MetaPill({
  label,
  tone,
}: {
  label: string;
  tone: keyof typeof PILL_TONES;
}) {
  const t = PILL_TONES[tone];
  return (
    <View
      className="flex-row items-center gap-1.5 rounded-full border px-3 py-1.5"
      style={{ backgroundColor: t.bg, borderColor: t.border }}
    >
      <View
        className="size-1.5 rounded-full"
        style={{
          backgroundColor: t.dot,
          borderWidth: t.hollowDot ? 1 : 0,
          borderColor: t.dotBorder,
        }}
      />
      <Text className="text-xs font-semibold" style={{ color: t.text }}>
        {label}
      </Text>
    </View>
  );
}

export function VerificationBox({ place }: { place: PlaceDetail }) {
  // decision: Tags-harmonic state pill + short support (MESITA-927).
  const isPartner = place.listing_type === 'partner';
  return (
    <Box
      title="Verification"
      icon={isPartner ? BadgeCheck : CircleHelp}
      // MESITA-2031 reserved partner's own chroma; the unverified state stays
      // under this file's achromatic re-separation, at the same foreground
      // weight as the `amber` pill's hairline + hollow dot.
      iconColor={isPartner ? COLORS.partner : COLORS.foreground}
    >
      <View className="flex-row flex-wrap gap-2">
        <MetaPill
          label={isPartner ? 'Mesita Partner' : 'Web listing'}
          tone={isPartner ? 'partner' : 'amber'}
        />
      </View>
      <Text className="text-xs leading-relaxed text-muted-foreground">
        {isPartner
          ? 'Signed up on Mesita — can run rewards and take reservations.'
          : 'Web listing — claim to run Mesita rewards. Free for owners.'}
      </Text>
      {!isPartner ? (
        <Pressable
          onPress={() => void Linking.openURL('https://business.mesita.ai/add')}
          accessibilityRole="link"
          accessibilityLabel="Claim ownership — free"
          // Stays a quiet surface button: the ink fill in this Box belongs to
          // the Partner pill, and a second ink pill here would make "claimed"
          // and "claim it" wear the same chip. Its 44pt row and chevron already
          // read as the action.
          className="mt-0.5 min-h-11 flex-row items-center gap-1.5 self-start rounded-full border border-border bg-background px-3 py-2"
        >
          <Text className="text-xs font-semibold text-foreground">
            Claim ownership — free
          </Text>
          <ChevronRight color={COLORS.foreground} size={14} />
        </Pressable>
      ) : null}
    </Box>
  );
}

export function DatesBox({ place }: { place: PlaceDetail }) {
  // decision: Created + Updated Tag-style pills (MESITA-927). Hide while
  // enriching so we don't double-signal with the Enriching chip.
  if (place.is_enriching) return null;
  const created = place.created_label?.trim();
  const updated = place.updated_label?.trim();
  if (!created && !updated) return null;
  return (
    <Box title="Dates" icon={Clock} iconColor={COLORS.mutedForeground}>
      <View className="flex-row flex-wrap gap-2">
        {created ? <MetaPill label={`Created · ${created}`} tone="slate" /> : null}
        {updated ? <MetaPill label={`Updated · ${updated}`} tone="slate" /> : null}
      </View>
    </Box>
  );
}
