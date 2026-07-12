import { LinearGradient } from 'expo-linear-gradient';
import {
  AtSign,
  Bot,
  Crown,
  MessageCircle,
  Settings as SettingsIcon,
  Share2,
  UserRound,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BoxRow } from '@/components/ui/BoxRow';
import { Button } from '@/components/ui/Button';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import { apiUpdateConsumerProfile } from '@/lib/api/auth';
import { PREF_KEYS, useStoredFlag, useStoredString } from '@/lib/local-store';
import {
  ageFromBirthday,
  errMsg,
  firstInitials,
  formatSex,
} from '@/lib/utils';
import { useAuth } from '@/providers/auth';

const SUPPORT_EMAIL = 'support@mesita.ai';
const INSTAGRAM_URL = 'https://instagram.com/mesita.ai';
const TERMS_URL = 'https://www.mesita.ai/terms';
const PRIVACY_URL = 'https://www.mesita.ai/privacy';

const LANGUAGE_OPTIONS = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
];

const CITY_OPTIONS = [
  { value: 'cdmx', label: 'Ciudad de México' },
  { value: 'mty', label: 'Monterrey' },
  { value: 'gdl', label: 'Guadalajara' },
  { value: 'qro', label: 'Querétaro' },
  { value: 'pue', label: 'Puebla' },
  { value: 'cun', label: 'Cancún' },
  { value: 'tij', label: 'Tijuana' },
];

type Sheet = 'personal' | 'settings' | 'contact' | null;

// Me screen — web ProfileClient port (MESITA-583). Order: identity → Instagram
// → Class → Personal → Settings → Share → AI → Contact → Sign out. No Paper.
export default function MeScreen() {
  const { profile, consumerClass, session, refreshProfile, signOut } =
    useAuth();
  const isPremium = consumerClass?.class === 'premium';
  const [sheet, setSheet] = useState<Sheet>(null);

  const name = profile?.full_name ?? 'Mesita guest';
  const phone = profile?.phone ?? session?.user.phone ?? '';
  const age = ageFromBirthday(profile?.birthday);
  const sexLabel = formatSex(profile?.sex);
  const meta = [sexLabel, age != null ? `${age}` : null]
    .filter(Boolean)
    .join(' · ');
  const handle = profile?.instagram ?? null;
  const igConnected = Boolean(handle);
  const classLabel = isPremium ? 'Premium' : 'Free';
  const classVia =
    isPremium && consumerClass?.origin && consumerClass.origin !== 'default'
      ? consumerClass.origin
      : null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity hero — web ProfileSummaryCard DNA (no "Me" H1, no Chip). */}
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
                <Text
                  className="font-semibold text-foreground"
                  style={{ fontSize: 13 }}
                  numberOfLines={1}
                >
                  @{handle}
                </Text>
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

        <BoxRow
          Icon={AtSign}
          tint="pink"
          title="Instagram"
          summary="Connect Instagram to upgrade your class"
          onPress={() => undefined}
          soon
        />
        <BoxRow
          Icon={Crown}
          tint="amber"
          title="Class"
          summary="Upgrade your class for better rewards"
          onPress={() => undefined}
          soon
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
          onPress={() => undefined}
          soon
        />
        <BoxRow
          Icon={Bot}
          tint="violet"
          title="AI"
          summary="Connect your Mesita profile to an AI · Premium"
          onPress={() => undefined}
          soon
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
      />
      <ContactSheet
        visible={sheet === 'contact'}
        onClose={() => setSheet(null)}
      />
    </SafeAreaView>
  );
}

function PersonalDetailsSheet({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile, session } = useAuth();
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [birthday, setBirthday] = useState(profile?.birthday ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!firstName.trim()) {
      setError('First name required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiUpdateConsumerProfile({
        first_name: firstName.trim(),
        sex: (profile?.sex as 'male' | 'female' | 'other') ?? 'other',
        birthday: birthday || '',
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(errMsg(e, "Couldn't save your profile."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FullScreenSheet
      visible={visible}
      onClose={onClose}
      title="Personal details"
      subtitle="How you appear across Mesita"
    >
      <TextField
        label="First name"
        value={firstName}
        onChangeText={setFirstName}
        autoCapitalize="words"
        error={error && !firstName.trim() ? error : undefined}
      />
      <TextField
        label="Phone"
        value={profile?.phone ?? session?.user.phone ?? '—'}
        editable={false}
        helper="Phone is your sign-in identity and can’t be edited here."
      />
      <TextField
        label="Birthday (YYYY-MM-DD)"
        value={birthday}
        onChangeText={setBirthday}
        placeholder="1990-01-15"
        autoCapitalize="none"
      />
      {error && firstName.trim() ? (
        <Text className="text-destructive" style={{ fontSize: 13 }}>
          {error}
        </Text>
      ) : null}
      <Button loading={saving} disabled={saving} onPress={() => void save()}>
        Save
      </Button>
    </FullScreenSheet>
  );
}

function SettingsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [push, setPush] = useStoredFlag(PREF_KEYS.push, true);
  const [location, setLocation] = useStoredFlag(PREF_KEYS.location, true);
  const [contacts, setContacts] = useStoredFlag(PREF_KEYS.contacts, false);
  const [language, setLanguage] = useStoredString(PREF_KEYS.language, 'es');
  const [city, setCity] = useStoredString(PREF_KEYS.defaultCity, 'cdmx');

  return (
    <FullScreenSheet
      visible={visible}
      onClose={onClose}
      title="Settings"
      subtitle="Preferences on this device"
    >
      <SectionLabel>Notifications</SectionLabel>
      <PrefRow
        title="Push notifications"
        summary="Offers and reservation updates"
        value={push}
        onValueChange={setPush}
      />
      <SectionLabel>Permissions</SectionLabel>
      <PrefRow
        title="Location"
        summary="Better nearby recommendations"
        value={location}
        onValueChange={setLocation}
      />
      <PrefRow
        title="Contacts"
        summary="Find friends on Mesita"
        value={contacts}
        onValueChange={setContacts}
      />
      <SectionLabel>Preferences</SectionLabel>
      <SelectRow
        label="Language"
        value={language}
        options={LANGUAGE_OPTIONS}
        onChange={setLanguage}
      />
      <SelectRow
        label="Default city"
        value={city}
        options={CITY_OPTIONS}
        onChange={setCity}
      />
      <SectionLabel>Legal</SectionLabel>
      <LinkRow
        title="Terms of service"
        onPress={() => void Linking.openURL(TERMS_URL)}
      />
      <LinkRow
        title="Privacy policy"
        onPress={() => void Linking.openURL(PRIVACY_URL)}
      />
    </FullScreenSheet>
  );
}

function ContactSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <FullScreenSheet
      visible={visible}
      onClose={onClose}
      title="Contact us"
      subtitle="We usually reply within a day"
    >
      <BoxRow
        Icon={MessageCircle}
        tint="emerald"
        title="Email us"
        summary={SUPPORT_EMAIL}
        onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
      />
      <BoxRow
        Icon={SettingsIcon}
        tint="amber"
        title="Get help"
        summary="Report a problem or ask a question"
        onPress={() =>
          void Linking.openURL(
            `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
              'I need help with Mesita',
            )}`,
          )
        }
      />
      <BoxRow
        Icon={Share2}
        tint="pink"
        title="Instagram"
        summary="@mesita.ai"
        onPress={() => void Linking.openURL(INSTAGRAM_URL)}
      />
    </FullScreenSheet>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      className="mt-1 font-semibold uppercase text-muted-foreground"
      style={{ fontSize: 11, letterSpacing: 0.8 }}
    >
      {children}
    </Text>
  );
}

function PrefRow({
  title,
  summary,
  value,
  onValueChange,
}: {
  title: string;
  summary: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <View className="mb-2 flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-foreground" style={{ fontSize: 15 }}>
          {title}
        </Text>
        <Text className="text-muted-foreground" style={{ fontSize: 12 }}>
          {summary}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={title}
      />
    </View>
  );
}

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (next: string) => void;
}) {
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <BoxRow
      Icon={SettingsIcon}
      tint="muted"
      title={label}
      summary={current}
      onPress={() => {
        Alert.alert(label, undefined, [
          ...options.map((o) => ({
            text: o.label,
            onPress: () => onChange(o.value),
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]);
      }}
    />
  );
}

function LinkRow({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <BoxRow
      Icon={Share2}
      tint="muted"
      title={title}
      summary="Opens in browser"
      onPress={onPress}
    />
  );
}
