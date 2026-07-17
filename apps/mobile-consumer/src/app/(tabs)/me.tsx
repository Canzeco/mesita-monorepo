import { useRouter } from 'expo-router';
import {
  AtSign,
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
import { IdentityHero } from '@/components/me/IdentityHero';
import { CLASSES } from '@/lib/consumer-classes';
import { useEffectiveClass } from '@/lib/mock-class';
import {
  ageFromBirthday,
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
