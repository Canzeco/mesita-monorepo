import { Image } from "expo-image";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { createPlace } from "@/features/place";
import { colors, radius, space } from "@/theme";

import { previewGooglePlace } from "../api";

export type GenerateTarget = { gid: string; name: string; address: string | null };

/** Confirm, then create, then open the place. A refusal keeps the place and turns Generate off. */
export function GenerateSheet({
  target,
  onClose,
  onOpen,
}: {
  target: GenerateTarget | null;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const preview = useQuery({
    queryKey: ["place-preview", target?.gid],
    enabled: target !== null,
    queryFn: ({ signal }) => previewGooglePlace(target?.gid ?? "", signal),
  });
  const [openingId, setOpeningId] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => createPlace(target?.gid ?? ""),
    onSuccess: (place) => setOpeningId(place.id),
  });
  useEffect(() => {
    if (!openingId) return;
    const id = setTimeout(() => onOpen(openingId), 400);
    return () => clearTimeout(id);
  }, [openingId, onOpen]);
  const facts = preview.data;
  const refused = facts !== undefined && !facts.canAdd;
  const name = facts?.name || target?.name || "";
  const address = facts?.address || target?.address;
  const title = openingId ? "Opening profile…" : create.isPending ? "Generating profile…" : create.isError ? "Couldn't generate this profile" : refused ? "Can't add this place" : "Generate a profile?";
  const body = create.isError ? "Try again." : refused ? facts?.message || "Can't add this place" : "We'll build its profile from Google.";
  return (
    <Modal visible={target !== null} transparent animationType="fade" onRequestClose={() => { if (!create.isPending) onClose(); }}>
      <View style={styles.scrim}>
        <View style={styles.card}>
          {facts?.photoUrl ? <Image source={facts.photoUrl} style={styles.photo} contentFit="cover" /> : <Icon name="sparkles" size={28} />}
          <Text role="title" style={styles.center}>{title}</Text>
          <Text role="small" tone="muted" style={styles.center}>{body}</Text>
          {facts?.canAdd && facts.message ? <Text role="caption" style={styles.center}>{facts.message}</Text> : null}
          <View style={styles.place}>
            <Icon name="map-pin" size={20} color={colors.muted} />
            <View style={styles.words}>
              <Text role="strong" numberOfLines={1}>{name}</Text>
              {facts?.category || facts?.rating ? (
                <Text role="caption" tone="muted" numberOfLines={1}>
                  {`${facts.category ?? ""}${facts.category && facts.rating ? " · " : ""}${facts.rating ? facts.rating.toFixed(1) : ""}`}
                </Text>
              ) : null}
              {address ? <Text role="caption" tone="muted" numberOfLines={2}>{address}</Text> : null}
            </View>
          </View>
          {create.isPending || openingId ? null : (
            <View style={styles.row}>
              <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancel}>
                <Text role="strong">Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={refused}
                onPress={() => create.mutate()}
                style={[styles.go, refused && styles.off]}
              >
                <Text role="strong" tone="onInk">{create.isError ? "Try again" : "Generate"}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center", padding: space.lg },
  card: { width: "100%", borderRadius: radius.card, backgroundColor: colors.paper, padding: space.lg, gap: space.sm, alignItems: "center" },
  photo: { width: "100%", height: 140, borderRadius: radius.field },
  center: { textAlign: "center" },
  place: { alignSelf: "stretch", flexDirection: "row", gap: space.sm, backgroundColor: colors.fill, borderRadius: radius.field, padding: space.md },
  words: { flex: 1, gap: 2 },
  row: { alignSelf: "stretch", flexDirection: "row", gap: space.sm, marginTop: space.sm },
  cancel: { flex: 1, minHeight: 48, borderRadius: radius.field, backgroundColor: colors.fill, alignItems: "center", justifyContent: "center" },
  go: { flex: 1, minHeight: 48, borderRadius: radius.field, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  off: { opacity: 0.4 },
});
