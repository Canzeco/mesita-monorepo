import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientButton } from '@/components/ui/gradient-button';
import { apiUpdateConsumerProfile } from '@/lib/api/auth';
import { useAuth } from '@/providers/auth';

const SEX_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const;

// Port of the web OnboardForm: {first_name, sex, birthday} →
// consumer-web-update-profile, then into the app.
export default function Onboard() {
  const router = useRouter();
  const { refreshProfile, signOut, session, onboarded } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [sex, setSex] = useState<(typeof SEX_OPTIONS)[number]['value'] | null>(null);
  const [birthday, setBirthday] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validBirthday = /^\d{4}-\d{2}-\d{2}$/.test(birthday.trim());
  const canSubmit = firstName.trim().length > 0 && sex !== null && validBirthday;

  // Already-onboarded users can land here transiently: after sign-in the
  // entry gate reads a still-loading (null) profile as "not onboarded" and
  // routes to /onboard, and after submit refreshProfile flips this true.
  // Bounce into the app as soon as the profile shows a complete row instead
  // of stranding a returning user on the form. Mirrors the web
  // (shell)/layout onboarded guard.
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
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-6"
      >
        <Text className="font-display text-3xl text-foreground">Welcome to Mesita</Text>
        <Text className="mt-2 text-sm text-muted-foreground">
          A few details and your table is ready.
        </Text>

        <View className="mt-8 rounded-3xl border border-border bg-card p-6">
          <Text className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            First name
          </Text>
          <TextInput
            className="rounded-lg border border-input bg-card px-3 py-3 text-base text-foreground"
            autoComplete="given-name"
            placeholder="Your name"
            placeholderTextColor="#775254"
            value={firstName}
            onChangeText={setFirstName}
          />

          <Text className="mb-2 mt-5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Sex
          </Text>
          <View className="flex-row gap-2">
            {SEX_OPTIONS.map((opt) => {
              const active = sex === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setSex(opt.value)}
                  className={
                    active
                      ? 'flex-1 items-center rounded-lg bg-primary px-3 py-2.5'
                      : 'flex-1 items-center rounded-lg bg-muted px-3 py-2.5'
                  }
                >
                  <Text
                    className={
                      active
                        ? 'text-sm font-semibold text-primary-foreground'
                        : 'text-sm text-muted-foreground'
                    }
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="mb-2 mt-5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Birthday (YYYY-MM-DD)
          </Text>
          <TextInput
            className="rounded-lg border border-input bg-card px-3 py-3 text-base text-foreground"
            keyboardType="numbers-and-punctuation"
            placeholder="1995-06-15"
            placeholderTextColor="#775254"
            value={birthday}
            onChangeText={setBirthday}
          />

          <View className="mt-6">
            <GradientButton
              label="Let's go"
              onPress={() => void submit()}
              loading={busy}
              disabled={!canSubmit}
            />
          </View>

          {error ? (
            <View className="mt-4 rounded-lg bg-destructive/10 px-3 py-2">
              <Text className="text-xs text-destructive">{error}</Text>
            </View>
          ) : null}
        </View>

        <Pressable onPress={() => void signOut()} className="mt-6 items-center">
          <Text className="text-xs text-muted-foreground">
            {session?.user.phone ? `Not ${session.user.phone}? ` : ''}Sign out
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
