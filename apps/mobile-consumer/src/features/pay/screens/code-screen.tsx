import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { EdgeError } from "@/lib/edge";
import { colors, space } from "@/theme";

import { answerBill, money, readPayCode } from "../api";

export function CodeScreen({ placeId, onClose }: { placeId: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const read = useQuery({
    queryKey: ["pay-code", placeId],
    queryFn: ({ signal }) => readPayCode(placeId, signal),
    enabled: placeId.length > 0,
    refetchInterval: 1000,
  });
  const bill = read.data?.bill ?? null;
  const payable = bill && (bill.state === "sent" || bill.state === "accepted" || bill.state === "confirming");
  const cents = bill?.quote?.outside_cents ?? ((bill?.bill_cents ?? 0) + (bill?.tip_cents ?? 0));

  const answer = async (action: "accept" | "decline" | "not_mine") => {
    if (!bill || busy) return;
    setBusy(true);
    setNote(null);
    try {
      await answerBill(bill.id, action, bill.version);
      await read.refetch();
    } catch (error) {
      setNote(error instanceof EdgeError ? "That did not go through." : "No connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        payable ? (
          <View style={styles.actions}>
            <Button label="Pay" busy={busy} onPress={() => void answer("accept")} />
            <Button label="Not mine" kind="secondary" disabled={busy} onPress={() => void answer("not_mine")} />
          </View>
        ) : (
          <Button label="Close" kind="secondary" onPress={onClose} />
        )
      }
    >
      <Text role="heading">{payable ? "Your bill" : "Show this to your waiter"}</Text>
      {bill?.place.name ? <Text role="strong">{bill.place.name}</Text> : null}
      {payable ? <Text role="title">{money(cents, bill.currency)}</Text> : null}
      {!payable && read.data?.code ? <Text role="code" selectable>{read.data.code.url}</Text> : null}
      {read.isError ? <Text role="body" tone="muted">The code did not load.</Text> : null}
      {note ? <Text role="body" tone="danger">{note}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: space.sm, backgroundColor: colors.paper },
});
