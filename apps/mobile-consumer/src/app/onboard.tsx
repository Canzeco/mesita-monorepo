import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import {
  Button,
  HelperText,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiUpdateConsumerProfile } from '@/lib/api/auth';
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}
      >
        <Text variant="headlineMedium" style={{ color: '#260409' }}>
          Welcome to Mesita
        </Text>
        <Text
          variant="bodyMedium"
          style={{ marginTop: 8, color: '#775254' }}
        >
          A few details and your table is ready.
        </Text>

        <Surface
          elevation={2}
          style={{
            marginTop: 32,
            borderRadius: 16,
            padding: 24,
            backgroundColor: '#ffffff',
          }}
        >
          <TextInput
            mode="outlined"
            label="First name"
            autoComplete="given-name"
            value={firstName}
            onChangeText={setFirstName}
            style={{ backgroundColor: '#ffffff' }}
          />

          <Text
            variant="labelSmall"
            style={{ marginTop: 20, marginBottom: 8, color: '#775254' }}
          >
            SEX
          </Text>
          <SegmentedButtons
            value={sex ?? ''}
            onValueChange={(v) =>
              setSex(v as (typeof SEX_OPTIONS)[number]['value'])
            }
            buttons={SEX_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
          />

          <TextInput
            mode="outlined"
            label="Birthday (YYYY-MM-DD)"
            keyboardType="numbers-and-punctuation"
            placeholder="1995-06-15"
            value={birthday}
            onChangeText={setBirthday}
            style={{ marginTop: 20, backgroundColor: '#ffffff' }}
          />

          <Button
            mode="contained"
            onPress={() => void submit()}
            loading={busy}
            disabled={!canSubmit || busy}
            style={{ marginTop: 24 }}
            contentStyle={{ paddingVertical: 6 }}
          >
            Let&apos;s go
          </Button>

          {error ? (
            <HelperText type="error" visible style={{ marginTop: 8 }}>
              {error}
            </HelperText>
          ) : null}
        </Surface>

        <Button mode="text" onPress={() => void signOut()} style={{ marginTop: 24 }}>
          {session?.user.phone ? `Not ${session.user.phone}? Sign out` : 'Sign out'}
        </Button>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
