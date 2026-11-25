import { useState } from "react";
import { Alert, Linking } from "react-native";

import { Button } from "@/components/button";
import { FieldError } from "@/components/field";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";

import { deleteAccount, signOut } from "../session";
import { useSession } from "../store";

const SUPPORT = "support@mesita.ai";

export function SuspendedScreen() {
  const { suspended } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    await deleteAccount().catch((err: Error) => {
      setBusy(false);
      setError(err.message);
    });
  };

  const ask = () =>
    Alert.alert("Delete your account?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void remove() },
    ]);

  return (
    <Screen center>
      <Text role="title">Account suspended</Text>
      <Text tone="muted">{suspended ?? "This account is suspended."}</Text>
      <Button label={`Write to ${SUPPORT}`} onPress={() => void Linking.openURL(`mailto:${SUPPORT}`)} />
      <Button kind="secondary" label="Sign out" onPress={() => void signOut()} />
      <Button kind="danger" label="Delete account" busy={busy} onPress={ask} />
      {error ? <FieldError>{error}</FieldError> : null}
    </Screen>
  );
}
