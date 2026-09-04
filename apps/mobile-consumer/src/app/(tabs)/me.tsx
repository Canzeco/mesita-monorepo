import { useRouter } from 'expo-router';
import {
  Activity,
  AtSign,
  Bell,
  Bot,
  Crown,
  HelpCircle,
  MessageCircle,
  Settings as SettingsIcon,
  Share2,
  UserRound,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiConnectModal } from '@/components/me/AiConnectModal';
import { ClassModal } from '@/components/me/ClassModal';
import { HelpModal } from '@/components/me/HelpModal';
import { ContactSheet } from '@/components/me/contact-sheet';
import { DeleteAccountSheet } from '@/components/me/DeleteAccountSheet';
import {
  IdentityHero,
  IdentityHeroSkeleton,
} from '@/components/me/IdentityHero';
import {
  PersonalDetailsSheet,
  SettingsSheet,
} from '@/components/me/MeProfileSheets';
import { MetricsModal } from '@/components/me/MetricsModal';
import { MockControls } from '@/components/me/MockControls';
import { ShareModal } from '@/components/me/ShareModal';
import { VerifySocialSheet } from '@/components/me/VerifySocialSheet';
import { ShellWash } from '@/components/ui/HeroBackdrop';
import { TAB_SCROLL_PADDING_BOTTOM } from '@/lib/tab-layout';
import { BoxRow } from '@/components/ui/BoxRow';
import { Button } from '@/components/ui/Button';
import { apiFetchConsumerMetrics } from '@/lib/api/auth';
import { inboxTabPath } from '@/lib/consumer-route-contract';
import { CLASSES } from '@/lib/consumer-classes';
import { useEffectiveClass } from '@/lib/mock-class';
import {
  ageFromBirthday,
  formatCompactCount,
  formatPhoneDisplay,
  formatSex,
} from '@/lib/utils';
import { useAuth } from '@/providers/auth';

type Sheet =
  | 'personal'
  | 'settings'
  | 'contact'
  | 'help'
  | 'class'
  | 'metrics'
  | 'verify'
  | 'share'
  | 'ai'
  | 'delete'
  | null;

// Me screen — 583 chrome (NativeWind BoxRow) + 568 conversion modals.
// Order (MESITA-955): Instagram → Class → Personal → Settings → Metrics →
// Inbox → Share → AI → Help → Contact → Sign out.
// Box summaries mirror the card's live IG / Class status.
// decision: conversion rows LIVE (design lock profile-premium-20260720); no Stripe.
export default function MeScreen() {
  const router = useRouter();
  const { profile, consumerClass, stats, refreshProfile, signOut } = useAuth();
  const effective = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  const [sheet, setSheet] = useState<Sheet>(null);
  const [savedCents, setSavedCents] = useState<number | null>(null);
  const [visits, setVisits] = useState<number | null>(null);

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.full_name ||
    'Mesita member';
  const age = ageFromBirthday(profile?.birthday);
  const sexLabel = formatSex(profile?.sex);

  const classLabel =
    CLASSES.find((c) => c.id === effective.key)?.label ?? 'Bronze';
  // Prefer effective handle so IG mock (@mock) wins over a stale profile.
  const handle = effective.handle ?? profile?.instagram_handle ?? null;
  const igConnected = effective.origin === 'instagram' || Boolean(handle);
  const igSummary = igConnected
    ? [handle ? `@${handle}` : 'Connected', formatCompactCount(effective.followers)]
        .filter(Boolean)
        .join(' · ')
    : 'Instagram not connected';

  // Card metrics row: visits · saved from consumer-web-get-metrics.
  // Profile stats.visits is the fallback when metrics fails.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const metrics = await apiFetchConsumerMetrics();
        if (cancelled) return;
        setSavedCents(metrics.saved_cents);
        setVisits(metrics.places_visited);
      } catch {
        if (!cancelled) setVisits(stats?.visits ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stats?.visits, profile?.id]);

  function openVerify() {
    // Close Class before Verify — two FullScreenSheets must not stack.
    setSheet(null);
    setTimeout(() => setSheet('verify'), 50);
  }

  return (
    <ShellWash>
    <SafeAreaView className="flex-1" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: TAB_SCROLL_PADDING_BOTTOM, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Skeleton until profile lands — covers session-without-profile flash (#50). */}
        {!profile ? (
          <IdentityHeroSkeleton />
        ) : (
          <IdentityHero
            classKey={effective.key}
            name={name}
            sexLabel={sexLabel}
            age={age}
            phone={formatPhoneDisplay(profile?.phone)}
            phoneRaw={profile?.phone}
            avatarUrl={profile?.avatar_url}
            igConnected={igConnected}
            handle={handle}
            followers={effective.followers}
            classLabel={classLabel}
            savedCents={savedCents}
            visits={visits ?? stats?.visits ?? null}
          />
        )}

        <MockControls />

        <BoxRow
          Icon={AtSign}
          tint="pink"
          title="Instagram"
          summary={igSummary}
          onPress={() => setSheet('verify')}
        />
        <BoxRow
          Icon={Crown}
          tint="amber"
          title="Class"
          summary={classLabel}
          onPress={() => setSheet('class')}
        />

        <BoxRow
          Icon={UserRound}
          tint="sky"
          title="Personal details"
          summary="Name, phone, birthday, photo"
          onPress={() => setSheet('personal')}
          disabled={!profile}
        />
        <BoxRow
          Icon={SettingsIcon}
          tint="muted"
          title="Settings"
          summary="Notifications, privacy, language"
          onPress={() => setSheet('settings')}
        />

        {/* Metrics — after account cluster, before outward/support (MESITA-904). */}
        <BoxRow
          Icon={Activity}
          tint="violet"
          title="Metrics"
          summary="Visits, places, reviews — your numbers"
          onPress={() => setSheet('metrics')}
        />

        <BoxRow
          Icon={Bell}
          tint="pink"
          title="Activity"
          summary="Notifications and activity"
          onPress={() => router.push(inboxTabPath())}
        />

        <BoxRow
          Icon={Share2}
          tint="pink"
          title="Share"
          summary="Invite friends to Mesita"
          onPress={() => setSheet('share')}
        />
        <BoxRow
          Icon={Bot}
          tint="violet"
          title="AI"
          summary="Connect your Mesita profile to an AI · Premium"
          onPress={() => setSheet('ai')}
        />
        {/* Help — how the reward program works + the tier ladder. Moved off
            the Rewards wallet (MESITA-809): that page is for doing, this is
            for understanding. */}
        <BoxRow
          Icon={HelpCircle}
          tint="sky"
          title="Help"
          summary="How rewards work · tiers · discounts"
          onPress={() => setSheet('help')}
        />
        <BoxRow
          Icon={MessageCircle}
          tint="emerald"
          title="Contact"
          summary="Email, help, Instagram"
          onPress={() => setSheet('contact')}
        />

        <View className="mt-2">
          <Button variant="outline" onPress={() => void signOut()}>
            Sign out
          </Button>
        </View>
        <Text
          className="text-center text-muted-foreground"
          style={{ fontSize: 11 }}
        >
          Mesita · v2.4.1
        </Text>
      </ScrollView>

      <PersonalDetailsSheet
        visible={sheet === 'personal'}
        onClose={() => setSheet(null)}
        onSaved={() => void refreshProfile()}
      />
      <SettingsSheet
        visible={sheet === 'settings'}
        onClose={() => setSheet(null)}
        onDeleteAccount={() => setSheet('delete')}
      />
      <ContactSheet
        visible={sheet === 'contact'}
        onClose={() => setSheet(null)}
      />
      <HelpModal visible={sheet === 'help'} onClose={() => setSheet(null)} />
      <MetricsModal
        visible={sheet === 'metrics'}
        onClose={() => setSheet(null)}
      />

      <ClassModal
        visible={sheet === 'class'}
        onClose={() => setSheet(null)}
        onConnectInstagram={openVerify}
      />
      <VerifySocialSheet
        visible={sheet === 'verify'}
        onClose={() => setSheet(null)}
      />
      <ShareModal
        visible={sheet === 'share'}
        onClose={() => setSheet(null)}
      />
      <AiConnectModal
        visible={sheet === 'ai'}
        onClose={() => setSheet(null)}
      />
      <DeleteAccountSheet
        visible={sheet === 'delete'}
        onClose={() => setSheet(null)}
      />
    </SafeAreaView>
    </ShellWash>
  );
}
