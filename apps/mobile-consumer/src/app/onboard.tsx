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

// Male/Female only (MESITA-727).
const SEX_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
] as const;

export default function Onboard() {
  const router = useRouter();
  const { refreshProfile, signOut, session, onboarded } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [sex, setSex] = useState<(typeof SEX_OPTIONS)[number]['value'] | null>(
    null,
  );
  const [birthday, setBirthday] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validBirthday = /^\d{4}-\d{2}-\d{2}$/.test(birthday.trim());
  // Age gate — 13 or below is restricted (MESITA-727).
  const age = ageFromBirthday(birthday.trim());
  const underage = age !== null && age < MIN_SIGNUP_AGE;
  const canSubmit =
    firstName.trim().length > 0 && sex !== null && validBirthday && !underage;

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
            value={firstName}
            onChangeText={setFirstName}
          />

          <Text
            className="font-semibold text-muted-foreground"
            style={{ marginTop: 20, marginBottom: 8, color: '#775254' }}
          >
            SEX
          </Text>
          <View className="flex-row rounded-2xl border border-border bg-muted p-1">
            {SEX_OPTIONS.map((option) => {
              const active = sex === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setSex(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={
                    active
                      ? 'flex-1 items-center rounded-xl bg-card px-3 py-3'
                      : 'flex-1 items-center rounded-xl px-3 py-3'
                  }
                >
                  <Text
                    className={
                      active
                        ? 'font-semibold text-foreground'
                        : 'font-semibold text-muted-foreground'
                    }
                    style={{ fontSize: 13 }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

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
            We use these to personalize recommendations. Your details are never
            shared with places.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
