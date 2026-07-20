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

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { apiUpdateConsumerProfile } from '@/lib/api/auth';
import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';
import { useAuth } from '@/providers/auth';

const SEX_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
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
  const canSubmit =
    firstName.trim().length > 0 && sex !== null && validBirthday;

  if (onboarded) {
    return <Redirect href={CONSUMER_ROUTES.homeDefault} />;
  }

  const submit = async () => {
    if (!sex) {
      setError('Pick a sex from the list.');
      return;
    }
    if (!firstName.trim() || !validBirthday) {
      setError('Please complete all required fields');
      return;
    }
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
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const phone = session?.user.phone ?? '';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-6"
      >
        <Text className="font-display text-[28px] font-semibold tracking-tight text-foreground">
          Tell us about you
        </Text>
        <Text className="mt-2 text-sm text-muted-foreground">
          A few details and your table is ready.
        </Text>

        {phone ? (
          <View className="mt-4 flex-row flex-wrap items-center gap-2">
            <View className="rounded-full border border-border bg-card px-3 py-1.5">
              <Text className="text-xs text-muted-foreground">
                Signed in as{' '}
                <Text className="font-semibold text-foreground">{phone}</Text>
              </Text>
            </View>
            <Pressable
              onPress={() => void signOut()}
              accessibilityRole="button"
              accessibilityLabel="Not you? Sign out"
            >
              <Text className="text-xs font-semibold text-primary">
                Not you?
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <TextField
            label="First name"
            autoComplete="given-name"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
          />

          <Text className="mb-2 mt-5 text-xs font-medium text-muted-foreground">
            Sex
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
                        ? 'text-[13px] font-semibold text-foreground'
                        : 'text-[13px] font-semibold text-muted-foreground'
                    }
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="mt-5">
            <TextField
              label="Birthday"
              keyboardType="numbers-and-punctuation"
              placeholder="YYYY-MM-DD"
              value={birthday}
              onChangeText={setBirthday}
            />
          </View>

          {error ? (
            <View className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2">
              <Text className="text-xs text-destructive">{error}</Text>
            </View>
          ) : null}

          <View className="mt-6">
            <Button
              onPress={() => void submit()}
              loading={busy}
              disabled={!canSubmit || busy}
            >
              Continue
            </Button>
          </View>

          <Text className="mt-3 text-center text-[11px] text-muted-foreground">
            We use these to personalize recommendations. Your details are never
            shared with places.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
