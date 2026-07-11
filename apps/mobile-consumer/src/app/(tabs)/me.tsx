import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import {
  AtSign,
  Bot,
  MessageCircle,
  Settings as SettingsIcon,
  Share2,
  UserRound,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import {
  Appbar,
  Button,
  Chip,
  HelperText,
  List,
  Modal,
  Portal,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff7f8' }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="headlineMedium" style={{ marginBottom: 4 }}>
          Me
        </Text>

        <View
          style={{
            overflow: 'hidden',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#ebd9db',
            padding: 16,
            backgroundColor: '#ffffff',
            ...SHADOW_ELEV,
          }}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <LinearGradient
              colors={isPremium ? [...GRADIENTS.premium] : [...GRADIENTS.pink]}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={{ borderRadius: 999, padding: 2.5 }}
            >
              <View
                style={{
                  width: 66,
                  height: 66,
                  borderRadius: 999,
                  backgroundColor: '#ffffff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="headlineSmall" style={{ color: 'rgba(38,4,9,0.7)' }}>
                  {firstInitials(name)}
                </Text>
              </View>
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="titleLarge" numberOfLines={1}>
                {name}
              </Text>
              <Text variant="bodyMedium" style={{ marginTop: 4, color: '#775254' }}>
                {phone || 'No phone added'}
              </Text>
              {meta ? (
                <Text
                  variant="bodySmall"
                  style={{ marginTop: 2, color: 'rgba(119,82,84,0.7)' }}
                >
                  {meta}
                </Text>
              ) : null}
            </View>
          </View>

          <View
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: 'rgba(235,217,219,0.6)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Chip
              icon={isPremium ? 'crown' : 'crown-outline'}
              compact
              style={{
                backgroundColor: isPremium ? '#eee8ff' : '#fef3c7',
              }}
            >
              {isPremium ? 'Premium' : 'Free'}
            </Chip>
            <Text variant="bodySmall" style={{ color: '#775254', flex: 1 }}>
              {isPremium
                ? 'Status on this account'
                : 'Manage Premium on the web'}
            </Text>
          </View>
        </View>

        <List.Section style={{ marginVertical: 0 }}>
          <List.Item
            title="Personal details"
            description="Name, phone, birthday"
            left={(props) => (
              <List.Icon {...props} icon={() => <UserRound color="#0284c7" size={22} />} />
            )}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => setSheet('personal')}
            style={rowStyle}
          />
          <List.Item
            title="Settings"
            description="Notifications, permissions, language"
            left={(props) => (
              <List.Icon
                {...props}
                icon={() => <SettingsIcon color="#775254" size={22} />}
              />
            )}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => setSheet('settings')}
            style={rowStyle}
          />
          <List.Item
            title="Contact"
            description="Email, help, Instagram"
            left={(props) => (
              <List.Icon
                {...props}
                icon={() => <MessageCircle color="#059669" size={22} />}
              />
            )}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => setSheet('contact')}
            style={rowStyle}
          />
          <SoonRow
            Icon={AtSign}
            tint="#fb2b7b"
            title="Instagram"
            summary="Connect Instagram to upgrade your class"
          />
          <SoonRow
            Icon={Share2}
            tint="#fb2b7b"
            title="Share"
            summary="Invite friends to Mesita"
          />
          <SoonRow
            Icon={Bot}
            tint="#7c3aed"
            title="AI"
            summary="Connect your Mesita profile to an AI · Premium"
          />
        </List.Section>

        <Button
          mode="contained"
          onPress={() => void signOut()}
          style={{ marginTop: 8 }}
          contentStyle={{ paddingVertical: 4 }}
        >
          Sign out
        </Button>
        <Text
          variant="labelSmall"
          style={{ textAlign: 'center', color: '#775254' }}
        >
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

const rowStyle = {
  backgroundColor: '#ffffff',
  borderRadius: 14,
  marginBottom: 8,
  borderWidth: 1,
  borderColor: '#ebd9db',
} as const;

function SoonRow({
  Icon,
  tint,
  title,
  summary,
}: {
  Icon: LucideIcon;
  tint: string;
  title: string;
  summary: string;
}) {
  return (
    <List.Item
      title={title}
      description={summary}
      left={(props) => (
        <List.Icon {...props} icon={() => <Icon color={tint} size={22} />} />
      )}
      right={() => (
        <Chip compact style={{ alignSelf: 'center', backgroundColor: '#faeff0' }}>
          Soon
        </Chip>
      )}
      onPress={() => Alert.alert(title, 'Coming soon.')}
      style={rowStyle}
    />
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
    <Portal>
      <Modal
        visible
        onDismiss={onClose}
        contentContainerStyle={{
          flex: 1,
          backgroundColor: '#fff7f8',
          margin: 0,
        }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <Appbar.Header style={{ backgroundColor: '#fff7f8' }} elevated>
            <Appbar.Content title={title} subtitle={subtitle} />
            <Appbar.Action icon="check" onPress={onClose} />
          </Appbar.Header>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Portal>
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
      <TextInput
        mode="outlined"
        label="First name"
        value={firstName}
        onChangeText={setFirstName}
        autoCapitalize="words"
        style={{ backgroundColor: '#ffffff' }}
      />
      <View>
        <TextInput
          mode="outlined"
          label="Phone"
          value={profile?.phone ?? session?.user.phone ?? '—'}
          editable={false}
          style={{ backgroundColor: '#faeff0' }}
        />
        <HelperText type="info" visible>
          Phone is your sign-in identity and can’t be edited here.
        </HelperText>
      </View>
      <TextInput
        mode="outlined"
        label="Birthday (YYYY-MM-DD)"
        value={birthday}
        onChangeText={setBirthday}
        placeholder="1990-01-15"
        autoCapitalize="none"
        style={{ backgroundColor: '#ffffff' }}
      />
      <Button
        mode="contained"
        onPress={() => void save()}
        loading={saving}
        disabled={saving}
        contentStyle={{ paddingVertical: 4 }}
      >
        Save
      </Button>
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
      <List.Section>
        <List.Subheader>Notifications</List.Subheader>
        <List.Item
          title="Push notifications"
          description="Offers and reservation updates"
          right={() => (
            <Switch value={push} onValueChange={(v) => setPush(v)} />
          )}
          style={rowStyle}
        />
        <List.Subheader>Permissions</List.Subheader>
        <List.Item
          title="Location"
          description="Better nearby recommendations"
          right={() => (
            <Switch value={location} onValueChange={(v) => setLocation(v)} />
          )}
          style={rowStyle}
        />
        <List.Item
          title="Contacts"
          description="Find friends on Mesita"
          right={() => (
            <Switch value={contacts} onValueChange={(v) => setContacts(v)} />
          )}
          style={rowStyle}
        />
        <List.Subheader>Preferences</List.Subheader>
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
        <List.Subheader>Legal</List.Subheader>
        <List.Item
          title="Terms of service"
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => void Linking.openURL(TERMS_URL)}
          style={rowStyle}
        />
        <List.Item
          title="Privacy policy"
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => void Linking.openURL(PRIVACY_URL)}
          style={rowStyle}
        />
      </List.Section>
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
      <List.Item
        title="Email us"
        description={SUPPORT_EMAIL}
        left={(props) => (
          <List.Icon
            {...props}
            icon={() => <MessageCircle color="#059669" size={22} />}
          />
        )}
        onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        style={rowStyle}
      />
      <List.Item
        title="Get help"
        description="Report a problem or ask a question"
        left={(props) => (
          <List.Icon
            {...props}
            icon={() => <SettingsIcon color="#d97706" size={22} />}
          />
        )}
        onPress={() =>
          void Linking.openURL(
            `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
              'I need help with Mesita',
            )}`,
          )
        }
        style={rowStyle}
      />
      <List.Item
        title="Instagram"
        description="@mesita.ai"
        left={(props) => (
          <List.Icon
            {...props}
            icon={() => <Share2 color="#fb2b7b" size={22} />}
          />
        )}
        onPress={() => void Linking.openURL(INSTAGRAM_URL)}
        style={rowStyle}
      />
    </SheetShell>
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
    <List.Item
      title={label}
      description={current}
      right={(props) => <List.Icon {...props} icon="chevron-right" />}
      onPress={() => {
        Alert.alert(label, undefined, [
          ...options.map((o) => ({
            text: o.label,
            onPress: () => onChange(o.value),
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]);
      }}
      style={rowStyle}
    />
  );
}
