import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { useActiveLocation } from "@/features/discovery";
import { colors, radius, space } from "@/theme";

import { listCredits, listPayPlaces, money, readPayCode } from "../api";
import { pendingLine } from "../open-bill";
import { needsGuest } from "../visit";
import { PlacesSheet } from "./places-screen";

type Kind = "prepay" | "pay";

export function PayScreen({
  signedIn,
  onSignIn,
  onPlace,
  onCode,
  onTickets,
}: {
  signedIn: boolean;
  onSignIn: () => void;
  onPlace: (id: string) => void;
  onCode: (id: string) => void;
  onTickets: () => void;
}) {
  const router = useRouter();
  const location = useActiveLocation();
  const at = location.location ? { lat: location.location.lat, lng: location.location.lng } : null;
  const places = useQuery({
    queryKey: ["pay-places", at?.lat ?? null, at?.lng ?? null],
    queryFn: ({ signal }) => listPayPlaces(at, signal),
    enabled: signedIn && location.location !== undefined,
  });
  const credits = useQuery({
    queryKey: ["pay-credits"],
    queryFn: ({ signal }) => listCredits(signal),
    enabled: signedIn,
  });
  const [open, setOpen] = useState<Kind | null>(null);
  const [addCard, setAddCard] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const openBill = useQuery({
    queryKey: ["open-bill"],
    queryFn: ({ signal }) => readPayCode({}, signal),
    enabled: signedIn,
  });
  const bill = needsGuest(openBill.data?.bill ?? null) ? openBill.data?.bill ?? null : null;
  useEffect(() => {
    if (!bill) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [bill]);

  if (!signedIn) {
    return (
      <View style={styles.signedOut}>
        <Text role="heading">Pay</Text>
        <Text role="body" tone="muted">Sign in to pay the way you do on the web.</Text>
        <Pressable accessibilityRole="button" onPress={onSignIn} style={styles.signIn}>
          <Text role="strong" tone="onInk">Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.head}>
        <Text role="wordmark" style={styles.word}>Mesita</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Tickets" onPress={onTickets} style={styles.tickets}>
          <Icon name="ticket" size={18} />
          <Text role="label">Tickets</Text>
        </Pressable>
      </View>
      {bill ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Pending Tickets" onPress={() => onCode(bill.place.id ?? "")} style={styles.pending}>
          <Text role="strong">Pending Tickets</Text>
          <Text role="label" numberOfLines={1}>{bill.place.name ?? "Your bill"}</Text>
          <Text role="small" tone="muted">{pendingLine(bill, now)}</Text>
          <Text role="numeric">{money((bill.quote ? bill.quote.outsideCents : (bill.billCents ?? 0) + bill.tipCents), bill.currency)}</Text>
        </Pressable>
      ) : null}
      <View style={styles.tiles}>
        <Tile label="Prepay Credits" line="Get Bonus" mark="%" color={colors.prepay} ink={colors.onPrepay} bubble={colors.ink} bubbleInk={colors.onInk} onPress={() => setOpen("prepay")} />
        <Tile label="Pay Bill" line={bill ? "See your bill" : "Cash, Card, or Credits"} mark="QR" color={colors.pay} ink={colors.onPay} bubble={colors.paper} bubbleInk={colors.pay} onPress={() => (bill ? onCode(bill.place.id ?? "") : setOpen("pay"))} />
      </View>
      <View style={styles.credits}>
        <Text role="strong" tone="onInk" style={styles.creditsTitle}>Credits</Text>
        <ScrollView style={styles.creditList} contentContainerStyle={styles.creditContent}>
          {credits.data?.length ? (
            credits.data.map((row) => (
              <Pressable key={row.placeId} accessibilityRole="button" onPress={() => onCode(row.placeId)} style={styles.creditRow}>
                <Text role="strong" numberOfLines={1} style={styles.creditName}>{row.name}</Text>
                <Text role="numeric">{money(row.spendableCents, row.currency)}</Text>
              </Pressable>
            ))
          ) : credits.isError ? null : (
            <Pressable accessibilityRole="button" onPress={() => setOpen("prepay")}>
              <Text role="label" tone="onInk" style={styles.empty}>Find a place</Text>
            </Pressable>
          )}
          {credits.isError ? (
            <View style={styles.failed}>
              <Text role="label">{"Couldn't load your credits"}</Text>
              <Text role="small" tone="muted">Check your connection and try again.</Text>
              <Pressable accessibilityRole="button" onPress={() => void credits.refetch()}>
                <Text role="label">Try again</Text>
              </Pressable>
            </View>
          ) : credits.isPending ? null : (
            <Pressable accessibilityRole="button" onPress={() => setAddCard(true)} style={styles.creditRow}>
              <Text role="strong">Add Loyalty Card</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
      <AddCard open={addCard} onClose={() => setAddCard(false)} onFind={() => { setAddCard(false); router.push("/search"); }} />
      <PlacesSheet
        kind={open}
        places={places.data ?? []}
        loading={places.isLoading}
        failed={places.isError}
        onRetry={() => void places.refetch()}
        onClose={() => setOpen(null)}
        onPick={(id) => {
          setOpen(null);
          if (open === "pay") onCode(id);
          else onPlace(id);
        }}
      />
    </View>
  );
}

function AddCard({ open, onClose, onFind }: { open: boolean; onClose: () => void; onFind: () => void }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.dialog}>
          <Text role="strong">Loyalty Cards add themselves</Text>
          <Text role="small" tone="muted">{"A place's card appears here the first time you get credits there."}</Text>
          <Text role="label">Buy credits at a place</Text>
          <Text role="small" tone="muted">Buy credits on its page and get a bonus.</Text>
          <Text role="label">Get a gift</Text>
          <Text role="small" tone="muted">A friend sends you credits for a place.</Text>
          <Pressable accessibilityRole="button" onPress={onFind} style={styles.find}>
            <Text role="label" tone="onInk">Find a place</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Text role="label" tone="muted">Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Tile({ label, line, mark, color, ink, bubble, bubbleInk, onPress }: { label: string; line: string; mark: string; color: string; ink: string; bubble: string; bubbleInk: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.tile, { backgroundColor: color }]}>
      <View style={[styles.bubble, { backgroundColor: bubble }]}>
        {mark === "QR" ? <Icon name="qr" size={22} color={bubbleInk} /> : <Text role="heading" style={{ color: bubbleInk }}>%</Text>}
      </View>
      <Text role="strong" style={{ color: ink }}>{label}</Text>
      <Text role="caption" style={{ color: ink }}>{line}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: space.sm, paddingTop: space.sm },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.sm },
  word: { paddingVertical: space.sm },
  tickets: { flexDirection: "row", alignItems: "center", gap: space.xs, backgroundColor: colors.fill, borderRadius: radius.control, paddingHorizontal: space.md, minHeight: 40 },
  pending: { backgroundColor: colors.paper, borderRadius: radius.field, padding: space.md, gap: 2, marginTop: space.sm },
  tiles: { flexDirection: "row", gap: space.sm },
  tile: { flex: 1, aspectRatio: 3 / 2, borderRadius: radius.card, alignItems: "center", justifyContent: "center", gap: 4 },
  bubble: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  credits: { flex: 1, marginVertical: space.sm, backgroundColor: colors.ink, borderRadius: radius.card, padding: 6 },
  creditsTitle: { textAlign: "center", paddingVertical: space.md },
  creditList: { flex: 1, backgroundColor: colors.paper, borderRadius: radius.field },
  creditContent: { paddingVertical: space.xs },
  creditRow: { minHeight: 56, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", gap: space.md },
  creditName: { flex: 1 },
  failed: { padding: space.md, gap: space.xs },
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: "center", padding: space.lg },
  dialog: { backgroundColor: colors.paper, borderRadius: radius.card, padding: space.lg, gap: space.sm },
  find: { minHeight: 44, borderRadius: radius.field, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  close: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  empty: { padding: space.lg },
  signedOut: { flex: 1, backgroundColor: colors.paper, padding: space.xl, gap: space.md, justifyContent: "center" },
  signIn: { backgroundColor: colors.ink, borderRadius: radius.control, minHeight: 48, alignItems: "center", justifyContent: "center" },
});
