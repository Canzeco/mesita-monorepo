import {
  Download,
  MessageCircle,
  Settings as SettingsIcon,
  Share2,
  Trash2,
} from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Text } from 'react-native';

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
import { apiUpdateConsumerProfile } from '@/lib/api/auth';
import { PREF_KEYS, useStoredFlag, useStoredString } from '@/lib/local-store';
import { errMsg } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

const SUPPORT_EMAIL = 'support@mesita.ai';
const INSTAGRAM_URL = 'https://instagram.com/mesita.ai';
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
        tint="muted"
        title="Delete account"
        summary="Permanently delete your account"
        onPress={() => {
          onClose();
          // Defer so Settings sheet unmounts before Delete mounts.
          setTimeout(onDeleteAccount, 50);
        }}
      />
    </FullScreenSheet>
  );
}

export function ContactSheet({
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
