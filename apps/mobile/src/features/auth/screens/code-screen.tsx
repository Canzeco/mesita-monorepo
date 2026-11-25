import { useEffect, useState } from "react";

import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";

import { authMessage, CODE_LENGTH, RESEND_SECONDS } from "../model";
import { sendCode, verifyCode } from "../session";

export function CodeScreen({ phone, onWrongNumber }: { phone: string; onWrongNumber: () => void }) {
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
    if (token.length !== CODE_LENGTH) return setError(`Enter the ${CODE_LENGTH} digits we texted you.`);
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
    <Screen footer={<Button label="Sign in" onPress={() => void verify(code)} busy={busy} testID="verify-code" />}>
      <Text tone="muted">{`We texted a ${CODE_LENGTH}-digit code to ${phone}.`}</Text>
      <Field
        label="Code"
        value={code}
        onChangeText={(typed) => {
          const digits = typed.replace(/\D/g, "").slice(0, CODE_LENGTH);
          setCode(digits);
          if (digits.length === CODE_LENGTH) void verify(digits);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        error={error}
        testID="code"
      />
      <Button
        kind="secondary"
        label={wait > 0 ? `Resend in ${wait}s` : "Resend the code"}
        disabled={wait > 0}
        onPress={() => void resend()}
      />
      <Button kind="quiet" label="Wrong number?" onPress={onWrongNumber} />
    </Screen>
  );
}
