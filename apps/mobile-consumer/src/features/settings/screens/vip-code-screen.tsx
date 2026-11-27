import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Text } from "@/components/text";
import { useSession } from "@/features/auth";
import { EdgeError } from "@/lib/edge";
import { queryClient } from "@/lib/query";
import { colors, space } from "@/theme";

import { redeemVipCode } from "../hub";

/** Twelve digits from an operator. The server decides. */
export function VipCodeScreen() {
  const guestId = useSession().guestId;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const digits = code.replace(/\D/g, "");
  const join = () => {
    if (digits.length !== 12 || busy) return;
    setBusy(true);
    setSaid(null);
    void redeemVipCode(digits)
      .then(async (outcome) => {
        if (guestId) await queryClient.invalidateQueries({ queryKey: ["profile"] });
        setSaid(outcome === "already_vip" ? "You are already VIP." : "You are VIP.");
      })
      .catch((err: unknown) => {
        const name = err instanceof EdgeError ? err.code : "";
        if (name === "invalid_code_format") setSaid("An invitation code is 12 digits.");
        else if (name === "code_invalid") setSaid("That code isn't valid.");
        else if (name === "too_many_tries") setSaid("Too many tries. Wait an hour.");
        else setSaid("Couldn't check the code. Try again.");
      })
      .finally(() => setBusy(false));
  };
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text role="body">Type the twelve digits you were given.</Text>
      <Field label="Invitation code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={14} />
      {said ? <Text role="small">{said}</Text> : null}
      <Button label={busy ? "Checking the code" : "Join VIP"} busy={busy} disabled={digits.length !== 12} onPress={join} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg, gap: space.md },
});
