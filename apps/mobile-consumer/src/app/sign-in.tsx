import { ChevronDown } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
} from 'react-native';
import {
  Button,
  HelperText,
  Surface,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HeroBackdrop } from '@/components/ui/HeroBackdrop';
import { apiConsumerSigninPhone } from '@/lib/api/auth';
import {
  combinePhoneE164,
  COUNTRIES,
  COUNTRY_BY_CODE,
  type Country,
} from '@/lib/countries';
import { supabase } from '@/lib/supabase';

// Phone OTP with country dial picker — web PhoneInputWithCountry parity.

export default function SignIn() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [countryCode, setCountryCode] = useState('MX');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localNumber, setLocalNumber] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const country: Country = COUNTRY_BY_CODE[countryCode] ?? COUNTRY_BY_CODE.MX;
  const e164 = useMemo(
    () => combinePhoneE164(countryCode, localNumber),
    [countryCode, localNumber],
  );
  const phoneOk = localNumber.replace(/\D/g, '').length >= 8;
  const codeOk = token.trim().length === 6;

  const sendCode = async () => {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setStep('code');
  };

  const verifyCode = async () => {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.verifyOtp({
      phone: e164,
      token: token.trim(),
      type: 'sms',
    });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    try {
      await apiConsumerSigninPhone();
    } catch {
      // Gate profile fetch covers routing.
    }
    setBusy(false);
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff7f8' }}>
      <HeroBackdrop />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}
        >
          <View style={{ marginBottom: 40, alignItems: 'center' }}>
            <Text
              variant="displaySmall"
              style={{ color: '#260409', letterSpacing: -0.4 }}
            >
              Mesita
            </Text>
            <Text
              variant="bodyMedium"
              style={{ marginTop: 12, textAlign: 'center', color: '#775254' }}
            >
              Tu mesa favorita te está esperando
            </Text>
          </View>

          <Surface
            elevation={2}
            style={{
              borderRadius: 16,
              padding: 24,
              backgroundColor: '#ffffff',
            }}
          >
            {step === 'phone' ? (
              <>
                <Text
                  variant="labelSmall"
                  style={{
                    marginBottom: 8,
                    color: '#775254',
                    letterSpacing: 1.2,
                  }}
                >
                  PHONE NUMBER
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'stretch',
                    borderWidth: 1,
                    borderColor: '#ebd9db',
                    borderRadius: 12,
                    overflow: 'hidden',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <Pressable
                    onPress={() => setPickerOpen(true)}
                    accessibilityLabel="Country dial code"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 12,
                      borderRightWidth: 1,
                      borderRightColor: '#ebd9db',
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>{country.flag}</Text>
                    <Text variant="titleSmall">+{country.dial}</Text>
                    <ChevronDown color="#775254" size={12} />
                  </Pressable>
                  <TextInput
                    mode="flat"
                    style={{ flex: 1, backgroundColor: '#ffffff' }}
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    placeholder="55 1234 5678"
                    value={localNumber}
                    onChangeText={setLocalNumber}
                    dense
                  />
                </View>
                <Button
                  mode="contained"
                  onPress={() => void sendCode()}
                  loading={busy}
                  disabled={!phoneOk || busy}
                  style={{ marginTop: 16 }}
                  contentStyle={{ paddingVertical: 6 }}
                >
                  Send code
                </Button>
              </>
            ) : (
              <>
                <Text
                  variant="labelSmall"
                  style={{
                    marginBottom: 8,
                    color: '#775254',
                    letterSpacing: 1.2,
                  }}
                >
                  CODE SENT TO {e164}
                </Text>
                <TextInput
                  mode="outlined"
                  style={{
                    backgroundColor: '#ffffff',
                    textAlign: 'center',
                    letterSpacing: 8,
                    fontSize: 24,
                  }}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  maxLength={6}
                  placeholder="••••••"
                  value={token}
                  onChangeText={setToken}
                />
                <Button
                  mode="contained"
                  onPress={() => void verifyCode()}
                  loading={busy}
                  disabled={!codeOk || busy}
                  style={{ marginTop: 16 }}
                  contentStyle={{ paddingVertical: 6 }}
                >
                  Verify
                </Button>
                <Button
                  mode="text"
                  onPress={() => setStep('phone')}
                  style={{ marginTop: 4 }}
                  compact
                >
                  Change number
                </Button>
              </>
            )}
            {error ? (
              <HelperText type="error" visible style={{ marginTop: 8 }}>
                {error}
              </HelperText>
            ) : null}
          </Surface>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setPickerOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              maxHeight: '70%',
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: 24,
            }}
          >
            <Text
              variant="titleMedium"
              style={{
                paddingHorizontal: 20,
                paddingTop: 20,
                paddingBottom: 12,
              }}
            >
              Country code
            </Text>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setCountryCode(item.code);
                    setPickerOpen(false);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    backgroundColor:
                      item.code === countryCode ? '#ffe4ef' : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{item.flag}</Text>
                  <Text variant="bodyLarge" style={{ flex: 1 }}>
                    {item.name}
                  </Text>
                  <Text variant="titleSmall">+{item.dial}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
