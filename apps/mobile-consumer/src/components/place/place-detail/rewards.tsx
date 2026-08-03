import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
// lucide-react-native has no Instagram glyph — AtSign is the house IG mark.
import { AtSign, Crown, Gift, QrCode, Sparkles } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_GLOW } from '@/constants/brand';
import { classProperLabel } from '@/lib/consumer-classes';
import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';
import { placeOffersMesitaRewards, resolveActivePromoRate } from '@/lib/promo-rates';
import type { ConsumerClassKey, PlaceDetail } from '@/lib/types/place-detail';
import { useAuth } from '@/providers/auth';
import { RewardMatrix, RewardStep } from './reward-matrix';
import { Box, BoxLabel } from './shared';

export function RewardsBox({ place }: { place: PlaceDetail }) {
  const router = useRouter();
  const { consumerClass } = useAuth();
  const classKey: ConsumerClassKey = (consumerClass?.class ??
    'standard') as ConsumerClassKey;
  const { welcome, default: returning, is_first_visit } = place.promo_matrix;
  const offersRewards = placeOffersMesitaRewards({
    listing_type: place.listing_type,
    promo_matrix: place.promo_matrix,
    promo_configured: place.promo_configured === true,
  });
  const isPartner = place.listing_type === 'partner';

  if (!offersRewards) {
    return (
      <Box title="Reward" icon={Sparkles} iconColor="#f472b6">
        <View className="items-center gap-3 py-3">
          <View className="size-12 items-center justify-center rounded-full bg-muted">
            <Gift color="#775254" size={20} />
          </View>
          <Text className="text-sm font-semibold text-foreground">
            {"This place doesn't offer rewards"}
          </Text>
          <Text className="text-center text-xs leading-snug text-muted-foreground">
            {isPartner
              ? "This Verified Partner isn't running a Mesita reward right now."
              : place.promo_configured
                ? 'Rewards are being set up for this place.'
                : 'Only Verified Partners run the Mesita reward program — this place is a web listing.'}
          </Text>
        </View>
      </Box>
    );
  }

  const activeValue = resolveActivePromoRate(
    place.promo_matrix,
    classKey,
    is_first_visit,
  );
  const mechanicWord = place.details.mechanic.toLowerCase();
  const capLabel =
    place.reward_cap_mxn != null && place.reward_cap_mxn > 0
      ? `MX$${place.reward_cap_mxn.toLocaleString('en-US')}`
      : null;
  const visitLabel = is_first_visit ? 'First visit' : 'Returning visit';
  const subtitle =
    activeValue == null
      ? `No reward at Mesita ${classProperLabel(classKey)} yet`
      : capLabel
        ? `${visitLabel} · on your first ${capLabel}`
        : visitLabel;
  // The claim action depends on the guest's own account, not the place:
  //   Standard → Pay with QR + Upgrade (claim now, or unlock a bigger reward)
  //   Elevated → one Pay-with-QR button, reward applies automatically
  // The class rung pays on every bill with no strings; the Story rung is the
  // INFLUENCER class's exclusive extra (segments v6 — resolveTicketRate,
  // _shared/rewards-config.ts), best-of so it only ever raises the rate.
  const isStandard = classKey === 'standard';
  const isInfluencer = classKey === 'influencer';

  return (
    <Box title="Reward" icon={Sparkles} iconColor="#f472b6">
      <LinearGradient
        colors={[...GRADIENTS.pink]}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={{ borderRadius: 12, padding: 16, ...SHADOW_GLOW }}
      >
        <Text className="font-display text-3xl font-semibold leading-none text-white">
          {activeValue == null ? '—' : `${activeValue}% ${mechanicWord}`}
        </Text>
        <Text className="mt-1.5 text-xs leading-snug text-white/90">
          {subtitle}
        </Text>
      </LinearGradient>

      <View className="gap-3">
        <BoxLabel>How it works</BoxLabel>
        <RewardStep
          n={1}
          icon={QrCode}
          title="Pay with your QR"
          body="Pay your bill and show your Mesita QR — the staff scan it to start your reward."
        />
        <RewardStep
          n={2}
          icon={AtSign}
          title={
            isInfluencer
              ? 'Post a story — optional, yours as an Influencer'
              : 'Post a story — Influencers only'
          }
          body={
            isInfluencer
              ? 'Want more? Post a story tagging the place after the staff scan your QR for a bigger reward. Skip it and you still keep your class reward in full.'
              : 'The Instagram Story bonus is exclusive to the Influencer class (1,000+ followers). Every class keeps its own reward — and the Google review bonus is open to all.'
          }
          accent
        />
        <RewardStep
          n={3}
          icon={Sparkles}
          title={`Get your ${mechanicWord}`}
          body={`Your ${mechanicWord} is applied automatically${
            capLabel ? ` — on the first ${capLabel} of your bill` : ''
          }.`}
        />
      </View>

      <RewardMatrix
        welcome={welcome}
        returning={returning}
        currentClass={classKey}
        isFirstVisit={is_first_visit}
      />

      <View className="gap-2">
        {isStandard ? (
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => router.push(CONSUMER_ROUTES.rewards.root)}
              className="flex-1 overflow-hidden rounded-lg"
            >
              <LinearGradient
                colors={[...GRADIENTS.pink]}
                start={GRADIENT_DIAGONAL.start}
                end={GRADIENT_DIAGONAL.end}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                }}
              >
                <QrCode color="#fff" size={16} />
                <Text className="text-sm font-semibold text-white">
                  Pay with QR
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={() => router.push(CONSUMER_ROUTES.me)}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3"
            >
              <Crown color="#260409" size={16} />
              <Text className="text-sm font-semibold text-foreground">
                Upgrade plan
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => router.push(CONSUMER_ROUTES.rewards.root)}
            className="overflow-hidden rounded-lg"
          >
            <LinearGradient
              colors={[...GRADIENTS.pink]}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 12,
                paddingHorizontal: 16,
              }}
            >
              <QrCode color="#fff" size={16} />
              <Text className="text-sm font-semibold text-white">
                Pay with QR to claim reward
              </Text>
            </LinearGradient>
          </Pressable>
        )}
        <Text className="text-center text-[11px] leading-snug text-muted-foreground">
          {isStandard
            ? 'Pay with your QR to claim your reward — or upgrade to Premium for a bigger one.'
            : 'Just pay with your QR — your reward applies automatically.'}
        </Text>
      </View>
    </Box>
  );
}
