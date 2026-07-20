import { LinearGradient } from 'expo-linear-gradient';
import {
  Camera,
  Download,
  Trash2,
  Users,
} from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import {
  LinkRow,
  PrefRow,
  SectionLabel,
  SelectRow,
} from '@/components/me/me-settings-rows';
import { BoxRow } from '@/components/ui/BoxRow';
import { Button } from '@/components/ui/Button';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { TextField } from '@/components/ui/TextField';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import {
  apiUpdateConsumerProfile,
  type ConsumerProfile,
} from '@/lib/api/auth';
import { PREF_KEYS, useStoredFlag, useStoredString } from '@/lib/local-store';
import { toast } from '@/lib/toast';
import { errMsg, firstInitials } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

const TERMS_URL = 'https://www.mesita.ai/terms';
const PRIVACY_URL = 'https://www.mesita.ai/privacy';
const PRIVACY_EMAIL = 'privacy@mesita.ai';

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

export function PersonalDetailsSheet({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile, session } = useAuth();
  // Remount form when opened so draft state re-seeds from profile (no effect).
  const formKey = visible
    ? `${profile?.first_name ?? ''}|${profile?.birthday ?? ''}|open`
    : 'closed';

  return (
    <FullScreenSheet
      visible={visible}
      onClose={onClose}
      title="Personal details"
      subtitle="How you appear across Mesita"
    >
      {profile ? (
        <PersonalDetailsForm
          key={formKey}
          profile={profile}
          phone={profile.phone ?? session?.user.phone ?? '—'}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : null}
    </FullScreenSheet>
  );
}

function PersonalDetailsForm({
  profile,
  phone,
  onClose,
  onSaved,
}: {
  profile: ConsumerProfile;
  phone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(profile.first_name ?? '');
  const [birthday, setBirthday] = useState(profile.birthday ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    firstName.trim() !== (profile.first_name ?? '') ||
    birthday !== (profile.birthday ?? '');

  const initials = firstInitials(
    firstName.trim() || profile.full_name || 'Mesita member',
  );

  const save = async () => {
    if (!dirty || saving) return;
    if (!firstName.trim()) {
      setError('First name required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiUpdateConsumerProfile({
        first_name: firstName.trim(),
        sex: (profile.sex as 'male' | 'female' | 'other') ?? 'other',
        birthday: birthday || '',
      });
      toast.success('Profile updated.');
      onSaved();
      onClose();
    } catch (e) {
      setError(errMsg(e, "Couldn't save your profile."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View className="items-center">
        <Pressable
          onPress={() => toast('Photo uploads are coming soon.')}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          className="relative"
        >
          <LinearGradient
            colors={[...GRADIENTS.pink]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: 80,
              height: 80,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <Text
              className="font-display font-bold text-white"
              style={{ fontSize: 28 }}
            >
              {initials}
            </Text>
          </LinearGradient>
          <View className="absolute -bottom-0.5 -right-0.5 h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-foreground">
            <Camera color="#fff7f8" size={14} />
          </View>
        </Pressable>
      </View>

      <TextField
        label="First name"
        value={firstName}
        onChangeText={setFirstName}
        autoCapitalize="words"
        error={error && !firstName.trim() ? error : undefined}
      />
      <TextField
        label="Phone"
        value={phone}
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
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button variant="outline" onPress={onClose}>
            Cancel
          </Button>
        </View>
        <View className="flex-1">
          <Button
            loading={saving}
            disabled={!dirty || saving}
            onPress={() => void save()}
          >
            Save
          </Button>
        </View>
      </View>
    </>
  );
}

export function SettingsSheet({
  visible,
  onClose,
  onDeleteAccount,
}: {
  visible: boolean;
  onClose: () => void;
  onDeleteAccount: () => void;
}) {
  const [push, setPush] = useStoredFlag(PREF_KEYS.push, true);
  const [location, setLocation] = useStoredFlag(PREF_KEYS.location, false);
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
        summary="Ticket updates and rewards"
        value={push}
        onValueChange={setPush}
      />

      <SectionLabel>Community</SectionLabel>
      <BoxRow
        Icon={Users}
        tint="violet"
        title="Communities"
        summary="Connect with your community"
        onPress={() => {}}
        soon
      />

      <SectionLabel>Permissions</SectionLabel>
      <PrefRow
        title="Location"
        summary="Recommend places near you"
        value={location}
        onValueChange={setLocation}
      />
      <PrefRow
        title="Contacts"
        summary="Find friends already on Mesita"
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
        label="Default location"
        value={city}
        options={CITY_OPTIONS}
        onChange={setCity}
      />

      <SectionLabel>Legal</SectionLabel>
      <LinkRow
        title="Terms of use"
        onPress={() => void Linking.openURL(TERMS_URL)}
      />
      <LinkRow
        title="Privacy policy"
        onPress={() => void Linking.openURL(PRIVACY_URL)}
      />

      <SectionLabel>Privacy & data</SectionLabel>
      <BoxRow
        Icon={Download}
        tint="emerald"
        title="Export my data"
        summary={PRIVACY_EMAIL}
        onPress={() =>
          void Linking.openURL(
            `mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent(
              'Export my Mesita data',
            )}`,
          )
        }
      />
      <BoxRow
        Icon={Trash2}
        tint="destructive"
        title="Delete account"
        summary="Permanently delete your account"
        onPress={() => {
          onClose();
          setTimeout(onDeleteAccount, 50);
        }}
      />

      <Text
        className="mt-2 text-center text-muted-foreground"
        style={{ fontSize: 11 }}
      >
        Mesita · v2.4.1
      </Text>
    </FullScreenSheet>
  );
}
