import { useQuery } from "@tanstack/react-query";
import { Alert, ScrollView, StyleSheet } from "react-native";

import { DEFAULT_CURRENCY, moneyLabel } from "@/generated/shared/lib/money";
import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { signOut } from "@/features/auth";
import { useErrorCopy } from "@/lib/error-copy";
import { space } from "@/theme";

import { creditsHeld, deleteAccount } from "../account";

/** Shows the credits still held, then asks, then closes the account. */
export function DeleteScreen() {
  const query = useQuery({ queryKey: ["credits-held"], queryFn: ({ signal }) => creditsHeld(signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} onRetry={() => void query.refetch()} />;
  const ask = () =>
    Alert.alert("Delete your account?", `You hold ${moneyLabel(query.data, DEFAULT_CURRENCY)} in credits. This cannot be undone.`, [
      { text: "Keep my account", style: "cancel" },
      {
        text: "Delete account",
        style: "destructive",
        onPress: () => {
          void deleteAccount().then(() => signOut());
        },
      },
    ]);
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text role="title">{moneyLabel(query.data, DEFAULT_CURRENCY)}</Text>
      <Text role="body">This is the credit still on your account. Deleting the account does not pay it out.</Text>
      <Button label="Delete account" kind="danger" onPress={ask} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { padding: space.lg, gap: space.md },
});
