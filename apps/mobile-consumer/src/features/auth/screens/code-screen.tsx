import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { colors, maxFontSizeMultiplier, radius, type } from "@/theme";

import { CoverNote, GreenButton } from "../components/cover-controls";
import { CoverPage } from "../components/cover-page";
import { authMessage, CODE_LENGTH, RESEND_SECONDS } from "../model";
import { sendCode, verifyCode } from "../session";

type Props = { phone: string; onWrongNumber: () => void };

export function CodeScreen({ phone, onWrongNumber }: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  // Signing in closes this task: the root layout's guard drops the route.
  const verify = async (token: string) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    const refused = await verifyCode(phone, token).catch((err: Error) => err);
    setBusy(false);
    if (refused) setError(authMessage(refused));
  };

  const resend = async () => {
    setError(null);
    const refused = await sendCode(phone).catch((err: Error) => err);
    if (refused) return setError(authMessage(refused));
    setCode("");
    setWait(RESEND_SECONDS);
  };

  return (
    <CoverPage>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Change number" onPress={onWrongNumber} style={styles.back}>
          <Icon name="arrow-left" size={12} color={colors.onPhotoSoft} />
          <Text role="label" tone="onPhotoSoft">
            Change number
          </Text>
        </Pressable>
        <Text role="small" tone="onPhotoSoft">
          {phone}
        </Text>
      </View>
      <View style={styles.field}>
        <Text role="label" tone="onPhotoSoft">
          {`${CODE_LENGTH}-digit code`}
        </Text>
        <TextInput
          accessibilityLabel={`${CODE_LENGTH}-digit code`}
          value={code}
          onChangeText={(typed) => {
            const digits = typed.replace(/\D/g, "").slice(0, CODE_LENGTH);
            setCode(digits);
            if (digits.length === CODE_LENGTH) void verify(digits);
          }}
          placeholder="123456"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          testID="code"
          style={styles.input}
        />
      </View>
      <CoverNote>{`We just texted you a ${CODE_LENGTH}-digit code.`}</CoverNote>
      {error ? <CoverNote error>{error}</CoverNote> : null}
      <GreenButton
        label="Verify"
        busy={busy}
        disabled={code.length !== CODE_LENGTH}
        onPress={() => void verify(code)}
        testID="verify-code"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: wait > 0 }}
        disabled={wait > 0}
        onPress={() => void resend()}
        style={styles.resend}
      >
        <Text role="label" tone={wait > 0 ? "onPhotoFaint" : "onPhotoSoft"}>
          {wait > 0 ? `Resend code in ${wait}s` : "Didn't get it? Resend code"}
        </Text>
      </Pressable>
    </CoverPage>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4 },
  field: { gap: 6 },
  input: { ...type.code, height: 52, color: colors.ink, textAlign: "center", borderRadius: radius.phone, backgroundColor: colors.paper },
  resend: { minHeight: 44, alignItems: "center", justifyContent: "center" },
});
