import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  AtSign,
  BadgeCheck,
  Bell,
  Bot,
  Crown,
  MessageCircle,
  Settings as SettingsIcon,
  Share2,
  UserRound,
} from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiConnectModal } from '@/components/me/AiConnectModal';
import { ClassModal } from '@/components/me/ClassModal';
import { DeleteAccountSheet } from '@/components/me/DeleteAccountSheet';
import {
  ContactSheet,
  PersonalDetailsSheet,
  SettingsSheet,
} from '@/components/me/MeProfileSheets';
import { MockControls } from '@/components/me/MockControls';
import { ShareModal } from '@/components/me/ShareModal';
import { VerifySocialSheet } from '@/components/me/VerifySocialSheet';
import { ShellWash } from '@/components/ui/HeroBackdrop';
import { BoxRow } from '@/components/ui/BoxRow';
import { Button } from '@/components/ui/Button';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import { CLASSES } from '@/lib/consumer-classes';
import { useEffectiveClass } from '@/lib/mock-class';
import {
  ageFromBirthday,
  firstInitials,
  formatSex,
} from '@/lib/utils';
import { useAuth } from '@/providers/auth';

type Sheet =
  | 'personal'
  | 'settings'
  | 'contact'
  | 'class'
  | 'verify'
  | 'share'
  | 'ai'
  | 'delete'
  | null;

// Me screen — 583 chrome (NativeWind BoxRow) + 568 conversion modals.
// Order: identity → Instagram → Class → Inbox → Personal → Settings → Share → AI → Contact.
export default function MeScreen() {
  const router = useRouter();
  const { profile, consumerClass, session, refreshProfile, signOut } =
    useAuth();
  const effective = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  const isPremium = effective.key === 'premium';
  const [sheet, setSheet] = useState<Sheet>(null);

  const name = profile?.full_name ?? 'Mesita guest';
  const phone = profile?.phone ?? session?.user.phone ?? '';
  const age = ageFromBirthday(profile?.birthday);
  const sexLabel = formatSex(profile?.sex);
  const meta = [sexLabel, age != null ? `${age}` : null]
    .filter(Boolean)
    .join(' · ');

  const classLabel =
    CLASSES.find((c) => c.id === effective.key)?.label ?? 'Free';
  const classVia =
    isPremium && effective.origin !== 'default' ? effective.origin : null;
  const handle = profile?.instagram_handle ?? effective.handle;
  const igConnected = effective.origin === 'instagram' || Boolean(handle);

  function openVerify() {
    setSheet('verify');
  }

  return (
    <ShellWash>
    <SafeAreaView className="flex-1" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <IdentityHero
          isPremium={isPremium}
          name={name}
          phone={phone}
          meta={meta}
          igConnected={igConnected}
          handle={handle ?? null}
          followers={effective.followers}
          classLabel={classLabel}
          classVia={classVia}
        />

        <MockControls />

        {/* decision: conversion rows LIVE so ported modals are reachable (no Stripe). */}
        <BoxRow
          Icon={AtSign}
          tint="pink"
          title="Instagram"
          summary="Connect Instagram to upgrade your class"
          onPress={() => setSheet('verify')}
        />
        <BoxRow
          Icon={Crown}
          tint="amber"
          title="Class"
          summary="Upgrade your class for better rewards"
          onPress={() => setSheet('class')}
        />

        <BoxRow
          Icon={Bell}
          tint="pink"
          title="Inbox"
          summary="Notifications and activity"
          onPress={() => router.push('/inbox/mine')}
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
          summary="Notifications, permissions, language"
          onPress={() => setSheet('settings')}
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
          Mesita · mobile
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

function IdentityHero({
  isPremium,
  name,
  phone,
  meta,
  igConnected,
  handle,
  followers,
  classLabel,
  classVia,
}: {
  isPremium: boolean;
  name: string;
  phone: string;
  meta: string;
  igConnected: boolean;
  handle: string | null;
  followers: number;
  classLabel: string;
  classVia: string | null;
}) {
  return (
    // Identity hero -- web ProfileSummaryCard DNA (no "Me" H1, no Chip).
    <View
      className="overflow-hidden rounded-3xl border border-border p-4"
      style={SHADOW_ELEV}
    >
      <LinearGradient
        colors={
          isPremium
            ? ['rgba(139,108,232,0.18)', 'rgba(140,204,255,0.14)']
            : ['rgba(251,43,123,0.10)', 'rgba(255,90,171,0.08)']
        }
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        }}
      />
      <View className="flex-row items-center gap-4">
        <LinearGradient
          colors={isPremium ? [...GRADIENTS.premium] : [...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{ borderRadius: 999, padding: 2.5 }}
        >
          <View className="h-[66px] w-[66px] items-center justify-center rounded-full bg-card">
            <Text
              className="font-display font-bold text-foreground/70"
              style={{ fontSize: 24 }}
            >
              {firstInitials(name)}
            </Text>
          </View>
        </LinearGradient>
        <View className="min-w-0 flex-1">
          <Text
            className="font-display font-bold text-foreground"
            style={{ fontSize: 20 }}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text
            className={
              phone
                ? 'mt-1 font-medium text-muted-foreground'
                : 'mt-1 text-muted-foreground/70'
            }
            style={{ fontSize: 14 }}
            numberOfLines={1}
          >
            {phone || 'No phone added'}
          </Text>
          {meta ? (
            <Text
              className="mt-0.5 text-muted-foreground/70"
              style={{ fontSize: 13 }}
              numberOfLines={1}
            >
              {meta}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="mt-4 gap-2.5 border-t border-border/60 pt-3.5">
        <View className="flex-row items-center gap-2.5">
          <LinearGradient
            colors={[...GRADIENTS.pink]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AtSign color="#ffffff" size={15} />
          </LinearGradient>
          {igConnected ? (
            <>
              <Text
                className="font-semibold text-foreground"
                style={{ fontSize: 13 }}
                numberOfLines={1}
              >
                {handle ? `@${handle}` : 'Connected'}
              </Text>
              {followers > 0 ? (
                <Text
                  className="text-muted-foreground"
                  style={{ fontSize: 12 }}
                >
                  {followers.toLocaleString('en-US')} followers
                </Text>
              ) : null}
              <BadgeCheck
                color="rgba(38,4,9,0.6)"
                size={18}
                style={{ marginLeft: 'auto' }}
              />
            </>
          ) : (
            <Text
              className="text-muted-foreground/80"
              style={{ fontSize: 13 }}
            >
              Not connected
            </Text>
          )}
        </View>
        <View className="flex-row items-center gap-2.5">
          {isPremium ? (
            <LinearGradient
              colors={[...GRADIENTS.premium]}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Crown color="#ffffff" size={15} />
            </LinearGradient>
          ) : (
            <View className="h-7 w-7 items-center justify-center rounded-lg bg-amber-400/20">
              <Crown color="#b45309" size={15} />
            </View>
          )}
          <Text
            className="font-semibold text-foreground"
            style={{ fontSize: 13 }}
          >
            Mesita {classLabel}
          </Text>
          {classVia ? (
            <Text className="text-muted-foreground" style={{ fontSize: 12 }}>
              via {classVia}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
