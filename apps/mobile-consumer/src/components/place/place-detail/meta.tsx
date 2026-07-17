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

export function VerificationBox({ place }: { place: PlaceDetail }) {
  const isPartner = place.listing_type === 'partner';
  return (
    <Box
      title="Verification"
      icon={isPartner ? BadgeCheck : CircleHelp}
      iconColor={isPartner ? '#0ea5e9' : '#94a3b8'}
    >
      {isPartner ? (
        <Text className="text-xs leading-relaxed text-muted-foreground">
          <Text className="font-semibold text-foreground">Verified Partner. </Text>
          This business signed up on Mesita, confirmed ownership, and can run
          rewards and take reservations through the app.
        </Text>
      ) : (
        <>
          <Text className="text-xs leading-relaxed text-muted-foreground">
            <Text className="font-semibold text-foreground">Not verified. </Text>
            {
              "This is a web listing Mesita found online. Details may be incomplete, and the place can't offer Mesita rewards until an owner claims it. Claiming ownership is completely free."
            }
          </Text>
          <Pressable
            onPress={() => void Linking.openURL('https://business.mesita.ai/add')}
            className="mt-1 flex-row items-center gap-1.5 self-start rounded-full bg-slate-500/10 px-3 py-2"
          >
            <Text className="text-xs font-semibold text-slate-700">
              {"Are you the owner? Claim ownership — it's free"}
            </Text>
            <ChevronRight color="#334155" size={14} />
          </Pressable>
        </>
      )}
    </Box>
  );
}

export function LastUpdatedBox({ place }: { place: PlaceDetail }) {
  if (place.is_enriching || !place.last_updated_label) return null;
  return (
    <Box title="Last update" icon={Clock} iconColor="#94a3b8">
      <Text className="text-sm font-medium tracking-wide text-muted-foreground">
        Updated {place.last_updated_label}
      </Text>
    </Box>
  );
}
