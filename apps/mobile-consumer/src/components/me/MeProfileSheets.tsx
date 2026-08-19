import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Camera,
  Download,
  Trash2,
  Users,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';

import {
  LinkRow,
  PrefRow,
  SectionLabel,
  SelectRow,
} from '@/components/me/me-settings-rows';
import { BirthdayPicker } from '@/components/ui/BirthdayPicker';
import { BoxRow } from '@/components/ui/BoxRow';
import { Button } from '@/components/ui/Button';
import { DefaultAvatar } from '@/components/ui/DefaultAvatar';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { SexSelector, toSexValue, type SexValue } from '@/components/ui/SexSelector';
import { TextField } from '@/components/ui/TextField';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { apiUpdateConsumerProfile } from '@/lib/api/auth';
import {
  mimeFromUri,
  uploadConsumerAvatar,
  validateAvatarBytes,
} from '@/lib/avatar-upload';
import { PREF_KEYS, useStoredFlag, useStoredString } from '@/lib/local-store';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { ageFromBirthday, errMsg, MIN_SIGNUP_AGE } from '@/lib/utils';
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
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  // null = nothing stored yet; a legacy profile shouldn't silently acquire a
  // sex just by opening this sheet, so it stays unset until picked.
  const [sex, setSex] = useState<SexValue | null>(toSexValue(profile?.sex));
  const [birthday, setBirthday] = useState(profile?.birthday ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const avatarUrl = previewUrl ?? profile?.avatar_url ?? null;

  const pickPhoto = async () => {
    if (uploadingPhoto) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast('Photo library access is needed to set your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const mime = mimeFromUri(asset.uri, asset.mimeType);
    const validationError = validateAvatarBytes(asset.fileSize, mime);
    if (validationError) {
      toast(validationError);
      return;
    }
    if (!mime) {
      toast('Unsupported file type. Use JPG, PNG, or WEBP.');
      return;
    }

    setPreviewUrl(asset.uri);
    setUploadingPhoto(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Sign in again to change your photo.');
      }
      const response = await fetch(asset.uri);
      const buffer = await response.arrayBuffer();
      // Re-check size from the fetched bytes when the picker omitted fileSize.
      const sizeError = validateAvatarBytes(buffer.byteLength, mime);
      if (sizeError) throw new Error(sizeError);

      const publicUrl = await uploadConsumerAvatar(
        supabase,
        user.id,
        buffer,
        mime,
      );
      await apiUpdateConsumerProfile({ avatar_url: publicUrl });
      toast('Photo updated.');
      onSaved();
      setPreviewUrl(null);
    } catch (e) {
      setPreviewUrl(null);
      toast(errMsg(e, "Couldn't upload your photo."));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const save = async () => {
    // Both halves are required — the EF re-derives full_name from them and
    // that's the name a reservation is booked under.
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name required');
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
      // Sex is only sent once it's set: the EF patches the keys it receives,
      // so omitting it leaves the stored value untouched rather than nulling
      // it (and never resurrects the dropped "other" value).
      await apiUpdateConsumerProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...(sex ? { sex } : {}),
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
      <View style={{ alignItems: 'center' }}>
        <Pressable
          onPress={() => void pickPhoto()}
          disabled={uploadingPhoto}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          hitSlop={8}
          style={{ position: 'relative', opacity: uploadingPhoto ? 0.7 : 1 }}
        >
          {/* Story-ring around the photo, matching the identity hero. */}
          <LinearGradient
            colors={[...GRADIENTS.pink]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: 80,
              height: 80,
              borderRadius: 999,
              padding: 2.5,
            }}
          >
            <View className="flex-1 overflow-hidden rounded-full bg-card">
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  accessibilityLabel="Profile photo"
                />
              ) : (
                <DefaultAvatar size={75} />
              )}
              {uploadingPhoto ? (
                <View
                  style={{
                    position: 'absolute',
                    inset: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.35)',
                  }}
                >
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
            </View>
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
        <Text
          className="text-muted-foreground"
          style={{ fontSize: 11, marginTop: 8 }}
        >
          JPG, PNG, or WEBP · max 2 MB
        </Text>
      </View>

      <TextField
        label="First name"
        value={firstName}
        onChangeText={setFirstName}
        autoCapitalize="words"
        autoComplete="given-name"
        maxLength={60}
        error={error && !firstName.trim() ? error : undefined}
      />
      <TextField
        label="Last name"
        value={lastName}
        onChangeText={setLastName}
        autoCapitalize="words"
        autoComplete="family-name"
        maxLength={60}
        error={error && firstName.trim() && !lastName.trim() ? error : undefined}
      />
      <TextField
        label="Phone"
        value={profile?.phone ?? session?.user.phone ?? '—'}
        editable={false}
        helper="Phone is your sign-in identity and can’t be edited here."
      />
      <View className="gap-1.5">
        <Text className="font-semibold text-foreground" style={{ fontSize: 13 }}>
          Sex
        </Text>
        <SexSelector value={sex} onChange={setSex} />
      </View>
      <View className="gap-1.5">
        <Text className="font-semibold text-foreground" style={{ fontSize: 13 }}>
          Birthday
        </Text>
        <BirthdayPicker value={birthday} onChange={setBirthday} />
      </View>
      {/* Name errors already render inline under their own field — only
          everything else (age gate, EF failures) surfaces down here. */}
      {error && firstName.trim() && lastName.trim() ? (
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
  const { profile, refreshProfile } = useAuth();
  const [push, setPush] = useStoredFlag(PREF_KEYS.push, true);
  const [location, setLocation] = useStoredFlag(PREF_KEYS.location, true);
  const [contacts, setContacts] = useStoredFlag(PREF_KEYS.contacts, false);
  const [language, setLanguage] = useStoredString(PREF_KEYS.language, 'es');
  const [city, setCity] = useStoredString(PREF_KEYS.defaultCity, 'cdmx');

  // EF-backed privacy (MESITA-913). Draft overrides the profile while a write
  // is in flight; otherwise the profile prop is the source of truth.
  const [privacyDraft, setPrivacyDraft] = useState<{
    privateAccount: boolean;
    showStories: boolean;
  } | null>(null);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const privateAccount =
    privacyDraft?.privateAccount ?? profile?.privacy_public === false;
  const showStories =
    privacyDraft?.showStories ?? profile?.privacy_show_stories !== false;

  async function persistPrivacy(
    draft: { privateAccount: boolean; showStories: boolean },
    patch: {
      privacy_public?: boolean;
      privacy_show_stories?: boolean;
    },
  ) {
    setPrivacyDraft(draft);
    setSavingPrivacy(true);
    try {
      await apiUpdateConsumerProfile(patch);
      await refreshProfile();
      setPrivacyDraft(null);
    } catch (e) {
      setPrivacyDraft(null);
      toast(errMsg(e, "Couldn't save privacy settings."));
    } finally {
      setSavingPrivacy(false);
    }
  }

  function onPrivateToggle(nextPrivate: boolean) {
    if (nextPrivate) {
      void persistPrivacy(
        { privateAccount: true, showStories: false },
        { privacy_public: false, privacy_show_stories: false },
      );
      return;
    }
    void persistPrivacy(
      { privateAccount: false, showStories },
      { privacy_public: true },
    );
  }

  function onStoriesToggle(next: boolean) {
    void persistPrivacy(
      { privateAccount, showStories: next },
      { privacy_show_stories: next },
    );
  }

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
        summary="Connect with your community · Soon"
        onPress={() => toast('Communities are coming soon.')}
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
      <SectionLabel>Privacy</SectionLabel>
      <PrefRow
        title="Private account"
        summary="When on, other guests see you as anonymous in the social feed and on reviews. Your Instagram can stay public — this only affects Mesita."
        value={privateAccount}
        onValueChange={onPrivateToggle}
        disabled={!profile || savingPrivacy}
      />
      <PrefRow
        title="Show stories on Mesita"
        summary="Let other Mesita guests see your story activity. Separate from posting to Instagram."
        value={showStories}
        onValueChange={onStoriesToggle}
        disabled={!profile || savingPrivacy}
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
