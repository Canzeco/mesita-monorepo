import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BirthdayPicker } from '@/components/ui/BirthdayPicker';
import { Button } from '@/components/ui/Button';
import { SexSelector, toSexValue, type SexValue } from '@/components/ui/SexSelector';
import { TextField } from '@/components/ui/TextField';
import { apiUpdateConsumerProfile } from '@/lib/api/auth';
import { ageFromBirthday, MIN_SIGNUP_AGE } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

export default function Onboard() {
  const router = useRouter();
  const { profile, refreshProfile, signOut, session, onboarded } = useAuth();
  // Consumers who onboarded before the last-name requirement land back here
  // once — prefill what they already gave us so it's a one-field ask.
  const storedSex = toSexValue(profile?.sex);
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  // Last name is required, not cosmetic: the EF joins first + last into
  // full_name, and that's the name the reservation agent books the table
  // under with the venue (web-consumer onboarding parity).
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [sex, setSex] = useState<SexValue | null>(storedSex);
  const [birthday, setBirthday] = useState(profile?.birthday ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validBirthday = /^\d{4}-\d{2}-\d{2}$/.test(birthday.trim());
  // Age gate — 13 or below is restricted (MESITA-727).
  const age = ageFromBirthday(birthday.trim());
  const underage = age !== null && age < MIN_SIGNUP_AGE;
  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    sex !== null &&
    validBirthday &&
    !underage;

  const phoneLabel = session?.user.phone ? `+${session.user.phone}` : null;

  if (onboarded) {
    return <Redirect href="/(tabs)/home" />;
  }

  const submit = async () => {
    if (!sex) return;
    setError(null);
    setBusy(true);
    try {
      await apiUpdateConsumerProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        sex,
        birthday: birthday.trim(),
      });
      await refreshProfile();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff7f8' }}>
      {/* Identity header — the signed-in phone is already on auth.user from the
          OTP step. "Not you?" signs out and returns to /sign-in. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        <Text
          className="text-muted-foreground"
          style={{ fontSize: 13 }}
          numberOfLines={1}
        >
          {phoneLabel ? `Signed in as ${phoneLabel}` : 'Signed in'}
        </Text>
        <Pressable
          onPress={() => void signOut()}
          accessibilityRole="button"
          accessibilityLabel="Not you? Sign out"
          hitSlop={8}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text className="font-semibold text-primary" style={{ fontSize: 13 }}>
            Not you?
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}
      >
        <Text
          className="font-display font-semibold text-foreground"
          style={{ fontSize: 28, letterSpacing: -0.42 }}
        >
          Welcome to Mesita
        </Text>
        <Text
          className="mt-2 text-muted-foreground"
          style={{ fontSize: 14 }}
        >
          A few details and your table is ready.
        </Text>

        <View
          className="rounded-2xl border border-border bg-card"
          style={{
            marginTop: 32,
            padding: 24,
            shadowColor: '#260409',
            shadowOpacity: 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
          }}
        >
          <TextField
            label="First name"
            autoComplete="given-name"
            autoCapitalize="words"
            maxLength={60}
            value={firstName}
            onChangeText={setFirstName}
          />

          <View style={{ marginTop: 16 }}>
            <TextField
              label="Last name"
              autoComplete="family-name"
              autoCapitalize="words"
              maxLength={60}
              value={lastName}
              onChangeText={setLastName}
            />
          </View>

          <Text
            className="font-semibold text-muted-foreground"
            style={{ marginTop: 20, marginBottom: 8, color: '#775254' }}
          >
            SEX
          </Text>
          <SexSelector value={sex} onChange={setSex} />

          <Text
            className="font-semibold text-muted-foreground"
            style={{ marginTop: 20, marginBottom: 8, color: '#775254' }}
          >
            BIRTHDAY
          </Text>
          <BirthdayPicker value={birthday} onChange={setBirthday} />

          {underage ? (
            <Text
              className="mt-2 text-destructive"
              style={{ fontSize: 12 }}
            >
              You must be at least {MIN_SIGNUP_AGE} to use Mesita.
            </Text>
          ) : null}

          <View style={{ marginTop: 24 }}>
            <Button
              onPress={() => void submit()}
              loading={busy}
              disabled={!canSubmit || busy}
            >
              Let&apos;s go
            </Button>
          </View>

          {error ? (
            <Text className="mt-2 text-destructive" style={{ fontSize: 12 }}>
              {error}
            </Text>
          ) : null}

          <Text
            className="text-muted-foreground"
            style={{ marginTop: 12, textAlign: 'center', fontSize: 11, lineHeight: 15 }}
          >
            We use these to personalize recommendations. Only your name is
            shared with a place — it&apos;s the name your reservation is booked
            under.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
