import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Camera,
  Download,
  Trash2,
} from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import {
  LinkRow,
  PrefRow,
  SectionLabel,
  SelectRow,
} from '@/components/me/me-settings-rows';
import { BirthdayPicker } from '@/components/ui/BirthdayPicker';
import { BoxRow } from '@/components/ui/BoxRow';
import { Button } from '@/components/ui/Button';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { TextField } from '@/components/ui/TextField';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { apiUpdateConsumerProfile } from '@/lib/api/auth';
import { PREF_KEYS, useStoredFlag, useStoredString } from '@/lib/local-store';
import { toast } from '@/lib/toast';
import {
  ageFromBirthday,
  errMsg,
  firstInitial,
  MIN_SIGNUP_AGE,
} from '@/lib/utils';
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
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [birthday, setBirthday] = useState(profile?.birthday ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatarUrl = profile?.avatar_url ?? null;
  const initials = firstInitial(firstName, 'M');

  const save = async () => {
    if (!firstName.trim()) {
      setError('First name required');
      return;
    }
    // Age gate — 13 or below is restricted (MESITA-727).
    const age = ageFromBirthday(birthday);
    if (age !== null && age < MIN_SIGNUP_AGE) {
      setError(`You must be at least ${MIN_SIGNUP_AGE} to use Mesita.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Sex isn't edited here and is never re-sent — the EF patches only the
      // keys present, so omitting it leaves the stored value untouched (and
      // avoids resurrecting the dropped "other" value).
      await apiUpdateConsumerProfile({
        first_name: firstName.trim(),
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
      {/* Tappable avatar — photo upload isn't wired to storage yet, so it
          surfaces a coming-soon toast rather than a dead control (web parity). */}
      <View style={{ alignItems: 'center' }}>
        <Pressable
          onPress={() => toast('Photo uploads are coming soon.')}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          hitSlop={8}
          style={{ position: 'relative' }}
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
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                accessibilityLabel="Profile photo"
              />
            ) : (
              <Text
                className="font-display font-bold"
                style={{ fontSize: 28, color: '#ffffff' }}
              >
                {initials}
              </Text>
            )}
          </LinearGradient>
          <View
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 28,
              height: 28,
              borderRadius: 999,
              backgroundColor: '#260409',
              borderWidth: 2,
              borderColor: '#fff7f8',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
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
        value={profile?.phone ?? session?.user.phone ?? '—'}
        editable={false}
        helper="Phone is your sign-in identity and can’t be edited here."
      />
      <View className="gap-1.5">
        <Text className="font-semibold text-foreground" style={{ fontSize: 13 }}>
          Birthday
        </Text>
        <BirthdayPicker value={birthday} onChange={setBirthday} />
      </View>
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
