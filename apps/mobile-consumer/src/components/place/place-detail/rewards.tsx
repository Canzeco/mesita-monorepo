import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Crown,
  Gift,
  MapPin,
  QrCode,
  Sparkles,
  Star,
  Ticket,
} from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_GLOW } from '@/constants/brand';
import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';
import {
  placeOffersMesitaRewards,
  strategyForPromoMatrix,
} from '@/lib/promo-rates';
import {
  REWARD_SEGMENT_BY_KEY,
  segmentKeyForClass,
  type RewardClassKey,
} from '@/lib/reward-segments';
import type { ConsumerClassKey, PlaceDetail } from '@/lib/types/place-detail';
import { useAuth } from '@/providers/auth';
import { RewardStep, YourRewardsHere } from './reward-matrix';
import { Box, BoxLabel } from './shared';

// ── Rewards tab (v7, MESITA-861) — web mirror ───────────────────────────
//
// hero  — "Up to N%" and NOTHING about why (MESITA-860). N = the guest's
//         best eligible rate at THIS place's strategy.
// steps — the wallet's four steps, "Pick place" pre-checked.
// list  — the guest's OWN row of the big table; the Standard-vs-Premium
//         comparison died (it classified the guest, and only knew the v6
//         first/returning model).
// CTAs  — "Get my ticket" routes to the wallet (create flow + the
//         Influencer story interstitial live there); Standard adds
//         "Go Premium".

export function RewardsBox({ place }: { place: PlaceDetail }) {
  const router = useRouter();
  const { consumerClass } = useAuth();
  const classKey: ConsumerClassKey = (consumerClass?.class ??
    'standard') as ConsumerClassKey;
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
              ? "This Mesita Partner isn't running a Mesita reward right now."
              : place.promo_configured
                ? 'Rewards are being set up for this place.'
                : 'Only Mesita Partners run the Mesita reward program — this place is a web listing.'}
          </Text>
        </View>
      </Box>
    );
  }

  // Strategy recovered from the four rate columns; the guest's ceiling here
  // = best of their standing rate and every action they can perform (story
  // only for Influencers — the gate is upstream, per segments v6).
  const strategy = strategyForPromoMatrix(place.promo_matrix);
  const rewardsKey = classKey as RewardClassKey;
  const mineRate =
    REWARD_SEGMENT_BY_KEY[segmentKeyForClass(rewardsKey)].rates[strategy];
  const candidates = [
    mineRate,
    REWARD_SEGMENT_BY_KEY.welcome.rates[strategy],
    REWARD_SEGMENT_BY_KEY.review.rates[strategy],
    REWARD_SEGMENT_BY_KEY.story.rates[strategy],
  ];
  const upTo = Math.max(...candidates);

  const capLabel =
    place.reward_cap_mxn != null && place.reward_cap_mxn > 0
      ? `MX$${place.reward_cap_mxn.toLocaleString('en-US')}`
      : null;
  const isStandard = classKey === 'standard';

  return (
    <Box title="Reward" icon={Sparkles} iconColor="#f472b6">
      {/* Hero — what you can get. Never why (MESITA-860). */}
      <LinearGradient
        colors={[...GRADIENTS.pink]}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={{ borderRadius: 12, padding: 16, ...SHADOW_GLOW }}
      >
        <Text className="font-display text-3xl font-semibold leading-none text-white">
          Up to {upTo}%
        </Text>
        <Text className="mt-1.5 text-xs leading-snug text-white/90">
          Discount for You — depending on your eligible bonuses
          {capLabel ? ` · on your first ${capLabel}` : ''}
        </Text>
      </LinearGradient>

      {/* How it works — the wallet's four steps, step 1 already done. */}
      <View className="gap-3">
        <BoxLabel>How it works</BoxLabel>
        <RewardStep
          n={1}
          icon={MapPin}
          title="Pick the place"
          body="Done — you're looking at it. Open your ticket from Rewards."
          done
        />
        <RewardStep
          n={2}
          icon={Star}
          title="Post your review"
          body="Do your bonuses before staff scan — a Google review, your Mesita rating, a story if Instagram is connected."
          accent
        />
        <RewardStep
          n={3}
          icon={QrCode}
          title="Show your QR"
          body="Staff scan your ticket QR with any phone — no app on their side."
        />
        <RewardStep
          n={4}
          icon={Sparkles}
          title="Pay less"
          body={`Your best discount comes off the bill${
            capLabel ? ` — on the first ${capLabel}` : ''
          }. You pay the place directly.`}
        />
      </View>

      {/* The guest's own row of the big table. */}
      <View className="gap-3">
        <BoxLabel>Your rewards here</BoxLabel>
        <YourRewardsHere strategy={strategy} classKey={rewardsKey} />
      </View>

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
                <Ticket color="#fff" size={16} />
                <Text className="text-sm font-semibold text-white">
                  Get my ticket
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={() => router.push(CONSUMER_ROUTES.me)}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3"
            >
              <Crown color="#260409" size={16} />
              <Text className="text-sm font-semibold text-foreground">
                Go Premium
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
              <Ticket color="#fff" size={16} />
              <Text className="text-sm font-semibold text-white">
                Get my ticket
              </Text>
            </LinearGradient>
          </Pressable>
        )}
        <Text className="text-center text-[11px] leading-snug text-muted-foreground">
          Open your ticket in Rewards — your best bonus applies on its own.
        </Text>
      </View>
    </Box>
  );
}
