import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import {
  AtSign,
  Bot,
  ChevronRight,
  Crown,
  MessageCircle,
  Settings as SettingsIcon,
  Share2,
  UserRound,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientButton } from '@/components/ui/gradient-button';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import { apiUpdateConsumerProfile } from '@/lib/api/auth';
import {
  PREF_KEYS,
  useStoredFlag,
  useStoredString,
} from '@/lib/local-store';
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

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-4 pb-10 gap-3"
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-1 font-display text-3xl text-foreground">Me</Text>

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
            <View
              className="rounded-full p-[2.5px]"
              style={{ overflow: 'hidden' }}
            >
              <LinearGradient
                colors={
                  isPremium
                    ? [...GRADIENTS.premium]
                    : [...GRADIENTS.pink]
                }
                start={GRADIENT_DIAGONAL.start}
                end={GRADIENT_DIAGONAL.end}
                style={{ borderRadius: 999, padding: 2.5 }}
              >
                <View className="size-[66px] items-center justify-center rounded-full bg-card">
                  <Text className="font-display text-2xl font-bold text-foreground/70">
                    {firstInitials(name)}
                  </Text>
                </View>
              </LinearGradient>
            </View>
            <View className="min-w-0 flex-1">
              <Text
                className="font-display text-[20px] font-bold text-foreground"
                numberOfLines={1}
              >
                {name}
              </Text>
              <Text className="mt-1 text-sm font-medium text-muted-foreground">
                {phone || 'No phone added'}
              </Text>
              {meta ? (
                <Text className="mt-0.5 text-[13px] text-muted-foreground/70">
                  {meta}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="mt-4 flex-row items-center gap-2.5 border-t border-border/60 pt-3.5">
            <View
              className={`size-7 items-center justify-center rounded-lg ${
                isPremium ? '' : 'bg-amber-400/20'
              }`}
            >
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
                  <Crown color="#fff" size={15} />
                </LinearGradient>
              ) : (
                <Crown color="#b45309" size={15} />
              )}
            </View>
            <Text className="text-[13px] font-semibold text-foreground">
              {isPremium ? 'Premium' : 'Free'}
            </Text>
            <Text className="text-[12px] text-muted-foreground">
              {isPremium
                ? 'Status on this account'
                : 'Manage Premium on the web'}
            </Text>
          </View>
        </View>

        <BoxRow
          Icon={UserRound}
          tint="sky"
          title="Personal details"
          summary="Name, phone, birthday"
          onPress={() => setSheet('personal')}
        />
        <BoxRow
          Icon={SettingsIcon}
          tint="muted"
          title="Settings"
          summary="Notifications, permissions, language"
          onPress={() => setSheet('settings')}
        />
        <BoxRow
          Icon={MessageCircle}
          tint="emerald"
          title="Contact"
          summary="Email, help, Instagram"
          onPress={() => setSheet('contact')}
        />

        {/* Parked conversion / secondary boxes — visible Soon stubs (web parity). */}
        <BoxRow
          Icon={AtSign}
          tint="pink"
          title="Instagram"
          summary="Connect Instagram to upgrade your class"
          soon
        />
        <BoxRow
          Icon={Share2}
          tint="pink"
          title="Share"
          summary="Invite friends to Mesita"
          soon
        />
        <BoxRow
          Icon={Bot}
          tint="violet"
          title="AI"
          summary="Connect your Mesita profile to an AI · Premium"
          soon
        />

        <View className="mt-2">
          <GradientButton label="Sign out" onPress={() => void signOut()} />
        </View>
        <Text className="text-center text-[11px] text-muted-foreground">
          Mesita · mobile
        </Text>
      </ScrollView>

      {sheet === 'personal' ? (
        <PersonalDetailsSheet
          onClose={() => setSheet(null)}
          onSaved={() => void refreshProfile()}
        />
      ) : null}
      {sheet === 'settings' ? (
        <SettingsSheet onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'contact' ? (
        <ContactSheet onClose={() => setSheet(null)} />
      ) : null}
    </SafeAreaView>
  );
}

function BoxRow({
  Icon,
  tint,
  title,
  summary,
  onPress,
  soon,
}: {
  Icon: LucideIcon;
  tint: 'sky' | 'muted' | 'emerald' | 'amber' | 'pink' | 'violet';
  title: string;
  summary: string;
  onPress?: () => void;
  soon?: boolean;
}) {
  const tintBg: Record<string, string> = {
    sky: 'bg-sky-500/10',
    muted: 'bg-muted',
    emerald: 'bg-emerald-500/10',
    amber: 'bg-amber-500/10',
    pink: 'bg-primary/10',
    violet: 'bg-violet-500/10',
  };
  const tintFg: Record<string, string> = {
    sky: '#0284c7',
    muted: '#775254',
    emerald: '#059669',
    amber: '#d97706',
    pink: '#fb2b7b',
    violet: '#7c3aed',
  };

  return (
    <Pressable
      onPress={
        soon
          ? () => Alert.alert(title, 'Coming soon.')
          : onPress
      }
      disabled={!soon && !onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 active:bg-muted/50"
      style={SHADOW_ELEV}
    >
      <View
        className={`size-10 items-center justify-center rounded-full ${tintBg[tint]}`}
      >
        <Icon color={tintFg[tint]} size={18} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-foreground">{title}</Text>
        <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
          {summary}
        </Text>
      </View>
      {soon ? (
        <View className="rounded-full bg-muted px-2 py-0.5">
          <Text className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
            Soon
          </Text>
        </View>
      ) : (
        <ChevronRight color="#77525466" size={18} />
      )}
    </Pressable>
  );
}

function SheetShell({
  onClose,
  title,
  subtitle,
  children,
}: {
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <View className="min-w-0 flex-1">
            <Text className="font-display text-xl font-semibold text-foreground">
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-xs text-muted-foreground">{subtitle}</Text>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            className="rounded-full bg-muted px-3 py-1.5"
          >
            <Text className="text-sm font-semibold text-foreground">Done</Text>
          </Pressable>
        </View>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 py-5 gap-4"
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function PersonalDetailsSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile, session } = useAuth();
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [birthday, setBirthday] = useState(profile?.birthday ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!firstName.trim()) {
      Alert.alert('First name required');
      return;
    }
    setSaving(true);
    try {
      await apiUpdateConsumerProfile({
        first_name: firstName.trim(),
        sex: (profile?.sex as 'male' | 'female' | 'other') ?? 'other',
        birthday: birthday || '',
      });
      onSaved();
      onClose();
    } catch (e) {
      Alert.alert("Couldn't save", errMsg(e, "Couldn't save your profile."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetShell
      onClose={onClose}
      title="Personal details"
      subtitle="How you appear across Mesita"
    >
      <Field label="First name">
        <TextInput
          value={firstName}
          onChangeText={setFirstName}
          placeholder="Your name"
          className="rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground"
          placeholderTextColor="#77525466"
          autoCapitalize="words"
        />
      </Field>
      <Field label="Phone">
        <View className="rounded-xl border border-border bg-muted/50 px-3 py-3">
          <Text className="text-sm text-muted-foreground">
            {profile?.phone ?? session?.user.phone ?? '—'}
          </Text>
        </View>
        <Text className="mt-1 text-[11px] text-muted-foreground">
          Phone is your sign-in identity and can’t be edited here.
        </Text>
      </Field>
      <Field label="Birthday (YYYY-MM-DD)">
        <TextInput
          value={birthday}
          onChangeText={setBirthday}
          placeholder="1990-01-15"
          className="rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground"
          placeholderTextColor="#77525466"
          autoCapitalize="none"
        />
      </Field>
      <GradientButton
        label={saving ? 'Saving…' : 'Save'}
        onPress={() => void save()}
        loading={saving}
        disabled={saving}
      />
    </SheetShell>
  );
}

function SettingsSheet({ onClose }: { onClose: () => void }) {
  const [push, setPush] = useStoredFlag(PREF_KEYS.push, true);
  const [location, setLocation] = useStoredFlag(PREF_KEYS.location, true);
  const [contacts, setContacts] = useStoredFlag(PREF_KEYS.contacts, false);
  const [language, setLanguage] = useStoredString(PREF_KEYS.language, 'es');
  const [city, setCity] = useStoredString(PREF_KEYS.defaultCity, 'cdmx');

  return (
    <SheetShell
      onClose={onClose}
      title="Settings"
      subtitle="Preferences on this device"
    >
      <Section title="Notifications">
        <ToggleRow
          label="Push notifications"
          sub="Offers and reservation updates"
          value={push}
          onChange={setPush}
        />
      </Section>
      <Section title="Permissions">
        <ToggleRow
          label="Location"
          sub="Better nearby recommendations"
          value={location}
          onChange={setLocation}
        />
        <ToggleRow
          label="Contacts"
          sub="Find friends on Mesita"
          value={contacts}
          onChange={setContacts}
        />
      </Section>
      <Section title="Preferences">
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
      </Section>
      <Section title="Legal">
        <LinkRow label="Terms of service" url={TERMS_URL} />
        <LinkRow label="Privacy policy" url={PRIVACY_URL} />
      </Section>
    </SheetShell>
  );
}

function ContactSheet({ onClose }: { onClose: () => void }) {
  return (
    <SheetShell
      onClose={onClose}
      title="Contact us"
      subtitle="We usually reply within a day"
    >
      <Pressable
        onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        className="flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5"
      >
        <View className="size-10 items-center justify-center rounded-full bg-emerald-500/10">
          <MessageCircle color="#059669" size={18} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-foreground">Email us</Text>
          <Text className="text-[11px] text-muted-foreground">
            {SUPPORT_EMAIL}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() =>
          void Linking.openURL(
            `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
              'I need help with Mesita',
            )}`,
          )
        }
        className="flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5"
      >
        <View className="size-10 items-center justify-center rounded-full bg-amber-500/10">
          <SettingsIcon color="#d97706" size={18} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-foreground">Get help</Text>
          <Text className="text-[11px] text-muted-foreground">
            Report a problem or ask a question
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => void Linking.openURL(INSTAGRAM_URL)}
        className="flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5"
      >
        <View className="size-10 items-center justify-center rounded-full bg-primary/10">
          <Share2 color="#fb2b7b" size={18} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-foreground">
            Instagram
          </Text>
          <Text className="text-[11px] text-muted-foreground">@mesita.ai</Text>
        </View>
      </Pressable>
    </SheetShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text className="mb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </Text>
      {children}
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </Text>
      <View className="overflow-hidden rounded-2xl border border-border bg-card">
        {children}
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: boolean;
  onChange: (next?: boolean) => void;
}) {
  return (
    <View className="flex-row items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-foreground">{label}</Text>
        <Text className="text-[11px] text-muted-foreground">{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => onChange(v)}
        trackColor={{ false: '#e8dfe0', true: '#fb2b7b99' }}
        thumbColor={value ? '#fb2b7b' : '#f4f3f4'}
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
    <Pressable
      onPress={() => {
        Alert.alert(label, undefined, [
          ...options.map((o) => ({
            text: o.label,
            onPress: () => onChange(o.value),
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]);
      }}
      className="flex-row items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0"
    >
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-foreground">{label}</Text>
        <Text className="text-[11px] text-muted-foreground">{current}</Text>
      </View>
      <ChevronRight color="#77525466" size={18} />
    </Pressable>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      className="flex-row items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0"
    >
      <Text className="min-w-0 flex-1 text-sm font-semibold text-foreground">
        {label}
      </Text>
      <ChevronRight color="#77525466" size={18} />
    </Pressable>
  );
}
