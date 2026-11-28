import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Icon } from "@/components/icon";
import { Skeleton } from "@/components/skeleton";
import { useErrorCopy } from "@/lib/error-copy";
import { colors } from "@/theme";

import { listReservations } from "../api";
import { halvesOf, ReservationRows, ReservationTabs, useNow, type ReservationHalf } from "./halves";

export function ReservationsScreen({ onOpen, onFind, onCalendar, half, onHalf }: { onOpen: (id: string) => void; onFind?: () => void; onCalendar?: () => void; half: ReservationHalf; onHalf: (half: ReservationHalf) => void }) {
  const query = useQuery({ queryKey: ["reservations"], queryFn: ({ signal }) => listReservations(signal) });
  const copy = useErrorCopy(query.error);
  const now = useNow();
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} onRetry={() => void query.refetch()} />;
  const rows = halvesOf(query.data, now)[half];
  return (
    <View style={styles.fill}>
      {onCalendar ? (
        <Stack.Screen
          options={{
            headerRight: () => (
              <Pressable accessibilityRole="button" accessibilityLabel="Calendar" onPress={onCalendar} hitSlop={8}>
                <Icon strokeWidth={2.25} name="calendar" size={22} />
              </Pressable>
            ),
          }}
        />
      ) : null}
      <ReservationTabs half={half} onPick={onHalf} />
      <ReservationRows
        rows={rows}
        empty={half === "past" ? "No past reservations" : "No upcoming reservations"}
        action={half === "upcoming" && onFind ? { label: "Find a place", onPress: onFind } : undefined}
        onOpen={onOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: colors.page } });
