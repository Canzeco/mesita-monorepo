import { getLocales } from "expo-localization";
import { useState } from "react";

import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";

import { authMessage, callingPrefix, toE164 } from "../model";
import { sendCode } from "../session";
import { useSession } from "../store";

export function PhoneScreen({ onSent }: { onSent: (phone: string) => void }) {
  const { notice } = useSession();
  const [typed, setTyped] = useState(() => callingPrefix(getLocales()[0]?.regionCode));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const number = toE164(typed);
    if (!number) return setError("Enter your full number with its country code.");
    setError(null);
    setBusy(true);
    const refused = await sendCode(number).catch((err: Error) => err);
    setBusy(false);
    if (refused) setError(authMessage(refused));
    else onSent(number);
  };

  return (
    <Screen footer={<Button label="Text me the code" onPress={() => void send()} busy={busy} testID="send-code" />}>
      {notice ? <Text tone="muted">{notice}</Text> : null}
      <Field
        label="Phone number"
        value={typed}
        onChangeText={setTyped}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        autoFocus
        error={error}
        testID="phone"
      />
    </Screen>
  );
}
