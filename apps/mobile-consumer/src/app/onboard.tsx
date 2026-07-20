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
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
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
  const canSubmit = firstName.trim().length > 0 && sex !== null && validBirthday;

  if (onboarded) {
    return <Redirect href={CONSUMER_ROUTES.homeDefault} />;
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

          <View style={{ marginTop: 20 }}>
            <TextField
            label="Birthday (YYYY-MM-DD)"
            keyboardType="numbers-and-punctuation"
            placeholder="1995-06-15"
            value={birthday}
            onChangeText={setBirthday}
            />
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
        </View>

        <View style={{ marginTop: 24 }}>
          <Button variant="ghost" onPress={() => void signOut()}>
            {session?.user.phone
              ? `Not ${session.user.phone}? Sign out`
              : 'Sign out'}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
