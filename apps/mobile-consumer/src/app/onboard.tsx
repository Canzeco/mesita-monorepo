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
import { TextField } from '@/components/ui/TextField';
import { apiUpdateConsumerProfile } from '@/lib/api/auth';
import { ageFromBirthday, MIN_SIGNUP_AGE } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

// Mirrors web's CONSUMER_SEXES (lib/consumer-onboarding.ts). Hand-copied
// rather than imported: the packages are independent install roots with no
// shared module, which is the same reason isOnboarded is hand-mirrored.
const SEXES = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
] as const;

export default function Onboard() {
  const router = useRouter();
  const { profile, refreshProfile, signOut, session, onboarded } = useAuth();
  // THREE fields, mirroring web's OnboardForm (MESITA-1829): first name,
  // birthday, sex. Sex is REQUIRED here as it is on web — the Passport
  // document prints `age · sex · country` and nothing else collects it. Last
  // name is still asked by the reservation flow instead, where the guest can
  // see why the place needs it.
  //
  // Prefilled so a half-onboarded consumer fills the one missing field.
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [birthday, setBirthday] = useState(profile?.birthday ?? '');
  const [sex, setSex] = useState<'male' | 'female' | ''>(
    profile?.sex === 'male' || profile?.sex === 'female' ? profile.sex : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validBirthday = /^\d{4}-\d{2}-\d{2}$/.test(birthday.trim());
  // Age gate — 13 or below is restricted (MESITA-727).
  const age = ageFromBirthday(birthday.trim());
  const underage = age !== null && age < MIN_SIGNUP_AGE;
  const canSubmit =
    firstName.trim().length > 0 && validBirthday && !underage && sex !== '';

  const phoneLabel = session?.user.phone ? `+${session.user.phone}` : null;

  if (onboarded) {
    return <Redirect href="/(tabs)/home" />;
  }

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await apiUpdateConsumerProfile({
        first_name: firstName.trim(),
        birthday: birthday.trim(),
        ...(sex === 'male' || sex === 'female' ? { sex } : {}),
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
          Last step before you&apos;re in.
        </Text>
        <Text
          className="mt-2 text-muted-foreground"
          style={{ fontSize: 14 }}
        >
          Three answers. Takes about fifteen seconds.
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

          <Text
            className="font-semibold text-foreground"
            style={{ marginTop: 20, marginBottom: 8, fontSize: 14 }}
          >
            Your birthday
          </Text>
          <BirthdayPicker value={birthday} onChange={setBirthday} />

          {underage ? (
            <Text
              className="mt-2 text-destructive"
              style={{ fontSize: 12 }}
            >
              You must be at least {MIN_SIGNUP_AGE} to use Mesita.
            </Text>
          ) : (
            <Text
              className="mt-2 text-muted-foreground"
              style={{ fontSize: 11, lineHeight: 15 }}
            >
              Private. It checks you&apos;re {MIN_SIGNUP_AGE} or over, and sets
              the age on your Passport.
            </Text>
          )}

          {/* Two options and no third: `consumers_sex_check` allows male and
              female only (narrowed by 20260825003000), so this list is the
              whole vocabulary. radiogroup rather than two buttons so
              TalkBack/VoiceOver announce it as one exclusive choice. */}
          <Text
            className="font-semibold text-foreground"
            style={{ marginTop: 20, marginBottom: 8, fontSize: 14 }}
          >
            Sex
          </Text>
          <View
            accessibilityRole="radiogroup"
            style={{ flexDirection: 'row', gap: 8 }}
          >
            {SEXES.map((option) => {
              const on = sex === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setSex(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={option.label}
                  className={
                    on
                      ? 'flex-1 items-center justify-center rounded-full border border-foreground bg-foreground'
                      : 'flex-1 items-center justify-center rounded-full border border-border bg-card'
                  }
                  style={{ height: 44 }}
                >
                  <Text
                    className={on ? 'text-background' : 'text-foreground'}
                    style={{ fontSize: 14, fontWeight: '600' }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

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
            Only your name is shared with a place — it&apos;s the name your
            reservation is booked under.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
