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

// THE ACHROMATIC RE-SEPARATION (MESITA-1954). These three tones used to differ
// in HUE ALONE — sky for "Mesita Partner", amber for an unclaimed "Web listing",
// slate for the Created/Updated dates — with bg/border/text/dot lightnesses near
// identical by construction. Greyed in place they would have rendered as one
// interchangeable chip: a status claim and a timestamp reading as peers, and the
// single most load-bearing fact about a place (claimed vs not) lost. That is the
// exact failure the web repaint shipped. The distinction now rides on FILL and
// WEIGHT, never on two similar greys:
//   solid   — the affirmative fact (Mesita Partner): ink pill, white label, filled dot.
//   outline — a real state nobody must act on (Web listing): hairline pill, hollow dot.
//   quiet   — metadata, not status (Created / Updated): muted fill, no visible
//             hairline, muted label.
const PILL_TONES = {
  solid: {
    bg: COLORS.foreground,
    text: COLORS.primaryForeground,
    border: COLORS.foreground,
    dot: COLORS.primaryForeground,
    dotBorder: 'transparent',
    hollowDot: false,
  },
  outline: {
    bg: COLORS.card,
    text: COLORS.foreground,
    border: COLORS.border,
    dot: 'transparent',
    dotBorder: COLORS.foreground,
    hollowDot: true,
  },
  quiet: {
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
      // Partner-blue vs unverified-amber grey out to two mid-greys a 16px glyph
      // at strokeWidth 1.75 cannot hold apart, so the header now carries the
      // fact by WEIGHT (ink = present, muted = absent) on top of the glyph swap.
      iconColor={isPartner ? COLORS.foreground : COLORS.mutedForeground}
    >
      <View className="flex-row flex-wrap gap-2">
        <MetaPill
          label={isPartner ? 'Mesita Partner' : 'Web listing'}
          tone={isPartner ? 'solid' : 'outline'}
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
        {created ? <MetaPill label={`Created · ${created}`} tone="quiet" /> : null}
        {updated ? <MetaPill label={`Updated · ${updated}`} tone="quiet" /> : null}
      </View>
    </Box>
  );
}
