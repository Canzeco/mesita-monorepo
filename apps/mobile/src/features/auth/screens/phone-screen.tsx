import { Host, Picker } from "@expo/ui";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { colors, maxFontSizeMultiplier, radius, type } from "@/theme";

import { CoverNote, GreenButton } from "../components/cover-controls";
import { CoverPage } from "../components/cover-page";
import { COUNTRIES, countryOf, type CountryCode } from "../countries";
import { authMessage, toE164 } from "../model";
import { sendCode } from "../session";
import { useSession } from "../store";

const TERMS = "By continuing you accept the Terms and Privacy Policy. SMS rates may apply.";

type Props = { onSent: (phone: string) => void; onClose?: () => void };

export function PhoneScreen({ onSent, onClose }: Props) {
  const { notice } = useSession();
  const [code, setCode] = useState<CountryCode>("MX");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const country = countryOf(code);

  const send = async () => {
    const number = toE164(typed.trim().startsWith("+") ? typed : `+${country.dial}${typed}`);
    if (!number) return setError("Enter your full phone number.");
    setError(null);
    setBusy(true);
    const refused = await sendCode(number).catch((err: Error) => err);
    setBusy(false);
    if (refused) setError(authMessage(refused));
    else onSent(number);
  };

  return (
    <CoverPage footer={TERMS} onClose={onClose}>
      {notice ? <CoverNote>{notice}</CoverNote> : null}
      <View style={styles.field}>
        <View style={styles.country}>
          <Text>{country.flag}</Text>
          <Text role="strong">{`+${country.dial}`}</Text>
          <Icon name="chevron-down" size={12} color={colors.muted} />
          {/* The system's own list, opened by a tap anywhere on the chip. */}
          <View style={styles.picker}>
            <Host style={styles.host} colorScheme="light" seedColor={colors.ink}>
              <Picker selectedValue={code} onValueChange={setCode} accessibilityLabel="Country dial code">
                {COUNTRIES.map(([value]) => {
                  const c = countryOf(value);
                  return <Picker.Item key={value} label={`${c.flag} +${c.dial} ${c.name}`} value={value} />;
                })}
              </Picker>
            </Host>
          </View>
        </View>
        <TextInput
          accessibilityLabel="Phone number"
          value={typed}
          onChangeText={setTyped}
          placeholder="55 1234 5678"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          testID="phone"
          style={styles.input}
        />
      </View>
      {error ? <CoverNote error>{error}</CoverNote> : null}
      <GreenButton label="Text me the code" busy={busy} onPress={() => void send()} testID="send-code" />
    </CoverPage>
  );
}

const styles = StyleSheet.create({
  field: { height: 52, flexDirection: "row", overflow: "hidden", borderRadius: radius.phone, backgroundColor: colors.paper },
  country: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 12,
    paddingRight: 8,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  picker: { ...StyleSheet.absoluteFill, overflow: "hidden", opacity: 0.02 },
  host: { flex: 1 },
  input: { ...type.body, flex: 1, paddingHorizontal: 12, color: colors.ink },
});
