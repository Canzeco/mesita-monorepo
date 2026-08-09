import { BadgeCheck, ChevronRight, CircleHelp, Clock, Tags } from 'lucide-react-native';
import { Linking, Pressable, Text, View } from 'react-native';

import type { PlaceDetail } from '@/lib/types/place-detail';
import { FACET_TINT } from '../place-detail-links';
import { Box } from './shared';

export function TagsBox({ place }: { place: PlaceDetail }) {
  if (place.tags.length === 0) return null;
  return (
    <Box title="Tags" icon={Tags} iconColor="#f472b6">
      <View className="flex-row flex-wrap gap-2">
        {place.tags.map((t) => {
          const tint = FACET_TINT[t.facet] ?? {
            bg: '#f8fafc',
            text: '#334155',
            border: '#e2e8f0',
            dot: '#94a3b8',
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

const PILL_TONES = {
  sky: { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd', dot: '#0ea5e9' },
  amber: { bg: '#fffbeb', text: '#b45309', border: '#fde68a', dot: '#f59e0b' },
  slate: { bg: '#f8fafc', text: '#334155', border: '#e2e8f0', dot: '#94a3b8' },
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
      <View className="size-1.5 rounded-full" style={{ backgroundColor: t.dot }} />
      <Text className="text-xs font-semibold" style={{ color: t.text }}>
        {label}
      </Text>
    </View>
  );
}

export function VerificationBox({ place }: { place: PlaceDetail }) {
  // decision: Tags-harmonic status pill + short support (MESITA-927).
  const isPartner = place.listing_type === 'partner';
  return (
    <Box
      title="Verification"
      icon={isPartner ? BadgeCheck : CircleHelp}
      iconColor={isPartner ? '#0ea5e9' : '#f59e0b'}
    >
      <View className="flex-row flex-wrap gap-2">
        <MetaPill
          label={isPartner ? 'Verified Partner' : 'Not verified'}
          tone={isPartner ? 'sky' : 'amber'}
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
          className="mt-0.5 min-h-11 flex-row items-center gap-1.5 self-start rounded-full border border-slate-200 bg-slate-50 px-3 py-2"
        >
          <Text className="text-xs font-semibold text-slate-700">
            Claim ownership — free
          </Text>
          <ChevronRight color="#334155" size={14} />
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
    <Box title="Dates" icon={Clock} iconColor="#94a3b8">
      <View className="flex-row flex-wrap gap-2">
        {created ? <MetaPill label={`Created · ${created}`} tone="slate" /> : null}
        {updated ? <MetaPill label={`Updated · ${updated}`} tone="slate" /> : null}
      </View>
    </Box>
  );
}
