import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { useActiveLocation } from "@/features/discovery";
import { colors, radius, space } from "@/theme";

import { listCredits, listPayPlaces, money } from "../api";
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
      <View style={styles.tiles}>
        <Tile label="Prepay" line="Get Bonus" mark="%" color={colors.prepay} ink={colors.onPrepay} bubble={colors.paper} bubbleInk={colors.prepay} onPress={() => setOpen("prepay")} />
        <Tile label="Pay Bill" line="Cash, Card, or Credits" mark="QR" color={colors.pay} ink={colors.onPay} bubble={colors.ink} bubbleInk={colors.onInk} onPress={() => setOpen("pay")} />
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
          ) : (
            <Text role="small" tone="muted" style={styles.empty}>No credits yet.</Text>
          )}
        </ScrollView>
      </View>
      <PlacesSheet
        kind={open}
        places={places.data ?? []}
        loading={places.isLoading}
        failed={places.isError}
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
  tiles: { flexDirection: "row", gap: space.sm },
  tile: { flex: 1, aspectRatio: 3 / 2, borderRadius: radius.card, alignItems: "center", justifyContent: "center", gap: 4 },
  bubble: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  credits: { flex: 1, marginVertical: space.sm, backgroundColor: colors.ink, borderRadius: radius.card, padding: 6 },
  creditsTitle: { textAlign: "center", paddingVertical: space.md },
  creditList: { flex: 1, backgroundColor: colors.paper, borderRadius: radius.field },
  creditContent: { paddingVertical: space.xs },
  creditRow: { minHeight: 56, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", gap: space.md },
  creditName: { flex: 1 },
  empty: { padding: space.lg },
  signedOut: { flex: 1, backgroundColor: colors.paper, padding: space.xl, gap: space.md, justifyContent: "center" },
  signIn: { backgroundColor: colors.ink, borderRadius: radius.control, minHeight: 48, alignItems: "center", justifyContent: "center" },
});
