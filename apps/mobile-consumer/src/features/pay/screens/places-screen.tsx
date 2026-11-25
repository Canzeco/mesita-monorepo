import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { colors, radius, space } from "@/theme";

import { acceptsCredits, bonusPct, cashbackBps, discountBps, offerScore, passesShow, VOUCHERS, type PayPlace, type PayShow, type PaySort } from "../places";
import { PlacePhoto } from "./photo";

type Kind = "prepay" | "pay";

export function PlacesSheet({
  kind,
  places,
  loading,
  failed,
  onClose,
  onPick,
}: {
  kind: Kind | null;
  places: PayPlace[];
  loading: boolean;
  failed: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PaySort>("closest");
  const [show, setShow] = useState<PayShow>("all");
  const [filters, setFilters] = useState(false);
  const rows = useMemo(() => {
    if (!kind) return [];
    const q = query.trim().toLowerCase();
    const list = places.filter((p) => passesShow(p, kind, show) && (!q || (p.name ?? "").toLowerCase().includes(q)));
    return [...list].sort((a, b) => {
      const score = sort === "best" ? offerScore(b, kind) - offerScore(a, kind) : 0;
      return score || (a.distance_m ?? Number.POSITIVE_INFINITY) - (b.distance_m ?? Number.POSITIVE_INFINITY);
    });
  }, [kind, places, query, show, sort]);

  return (
    <Modal visible={kind !== null} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: insets.top }]}>
        <View style={styles.head}>
          <Text role="title" style={styles.title}>{kind === "prepay" ? "Prepay" : "Pay"}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
            <Icon name="x" size={24} />
          </Pressable>
        </View>
        <View style={styles.tools}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={colors.muted}
            style={styles.search}
            autoCorrect={false}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Filters" onPress={() => setFilters(true)} style={styles.filter}>
            <Text role="strong">Filters</Text>
          </Pressable>
        </View>
        <Filters
          open={filters}
          kind={kind ?? "pay"}
          sort={sort}
          show={show}
          onSort={setSort}
          onShow={setShow}
          onClose={() => setFilters(false)}
        />
        {kind === "pay" ? <PayHeads /> : <PrepayHeads />}
        {failed ? <Text role="body" tone="muted" style={styles.note}>The places did not load.</Text> : null}
        {loading ? <Text role="body" tone="muted" style={styles.note}>Loading places.</Text> : null}
        <FlatList
          data={rows}
          keyExtractor={(p) => p.place_id}
          renderItem={({ item }) =>
            kind === "prepay" ? (
              <PrepayRow place={item} onPick={onPick} />
            ) : (
              <PayRow place={item} onPick={onPick} />
            )
          }
        />
      </View>
    </Modal>
  );
}

const SORTS: { id: PaySort; label: string }[] = [
  { id: "closest", label: "Closest" },
  { id: "best", label: "Best offers" },
];
const PREPAY_SHOWS: { id: PayShow; label: string }[] = [
  { id: "all", label: "All places" },
  { id: "one", label: "Sells a prepayment" },
];
const PAY_SHOWS: { id: PayShow; label: string }[] = [
  { id: "all", label: "All" },
  { id: "discount", label: "Discounts" },
  { id: "cashback", label: "Cashbacks" },
  { id: "either", label: "Discounts & cashbacks" },
];

function Filters({
  open,
  kind,
  sort,
  show,
  onSort,
  onShow,
  onClose,
}: {
  open: boolean;
  kind: Kind;
  sort: PaySort;
  show: PayShow;
  onSort: (id: PaySort) => void;
  onShow: (id: PayShow) => void;
  onClose: () => void;
}) {
  const options = kind === "prepay" ? PREPAY_SHOWS : PAY_SHOWS;
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.head}>
          <Text role="title" style={styles.title}>Filters</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
            <Icon name="x" size={24} />
          </Pressable>
        </View>
        <Text role="strong" tone="muted" style={styles.group}>Sort</Text>
        {SORTS.map((option) => (
          <Choice key={option.id} label={option.label} on={sort === option.id} onPress={() => onSort(option.id)} />
        ))}
        <Text role="strong" tone="muted" style={styles.group}>Show</Text>
        {options.map((option) => (
          <Choice key={option.id} label={option.label} on={show === option.id} onPress={() => onShow(option.id)} />
        ))}
      </View>
    </Modal>
  );
}

function Choice({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[styles.choice, on && styles.choiceOn]}>
      <Text role="strong">{label}</Text>
      <View style={[styles.dot, on && styles.dotOn]} />
    </Pressable>
  );
}

function PrepayHeads() {
  return (
    <View style={styles.bar}>
      <Text role="caption" tone="onInk" style={styles.barName}>Place</Text>
      {["$200", "$1,000", "$5,000"].map((label) => (
        <Text key={label} role="caption" tone="onInk" style={styles.barCell}>{label}</Text>
      ))}
    </View>
  );
}

function PayHeads() {
  return (
    <View style={styles.bar}>
      <Text role="caption" tone="onInk" style={styles.barName}>Place</Text>
      {["Accepts Credits", "Discount", "Cashback"].map((label) => (
        <Text key={label} role="caption" tone="onInk" style={styles.payHead}>{label}</Text>
      ))}
    </View>
  );
}

function PrepayRow({ place, onPick }: { place: PayPlace; onPick: (id: string) => void }) {
  const name = place.name ?? "A Mesita place";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={() => onPick(place.place_id)} style={styles.row}>
      <View style={styles.name}>
        <PlacePhoto place={place} />
        <Text role="label" numberOfLines={2} style={styles.nameText}>{name}</Text>
      </View>
      {VOUCHERS.map((key) => {
        const on = place.offers?.sell.includes(key) === true;
        const pct = on ? bonusPct(place.offers, key) : 0;
        return (
          <View key={key} style={[styles.bonus, { backgroundColor: on ? bonusColor(pct) : colors.fill }]}>
            <Text role="caption" tone={on && pct >= 40 ? "onPrepay" : "ink"}>{on ? `+${pct}%` : "–"}</Text>
          </View>
        );
      })}
    </Pressable>
  );
}

function PayRow({ place, onPick }: { place: PayPlace; onPick: (id: string) => void }) {
  const name = place.name ?? "A Mesita place";
  const discount = discountBps(place) / 100;
  const cashback = cashbackBps(place) / 100;
  const credits = acceptsCredits(place);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Select ${name}, Accepts Credits ${credits ? "Yes" : "No"}, Discount ${discount}%, Cashback ${cashback}%`}
      onPress={() => onPick(place.place_id)}
      style={styles.payRow}
    >
      <View style={styles.name}>
        <PlacePhoto place={place} />
        <Text role="label" numberOfLines={2} style={styles.nameText}>{name}</Text>
      </View>
      <View style={styles.offers}>
        <Cell label={credits ? "Yes" : "No"} on={credits} blue />
        <Cell label={`${discount}%`} on={discount > 0} />
        <Cell label={`${cashback}%`} on={cashback > 0} />
      </View>
    </Pressable>
  );
}

function bonusColor(pct: number): string {
  if (pct >= 60) return colors.bonus60;
  if (pct >= 40) return colors.prepay;
  if (pct >= 20) return colors.bonus20;
  return colors.bonusLow;
}

function offerColor(pct: number): string {
  if (pct >= 20) return colors.pay;
  if (pct >= 10) return colors.pay10;
  return colors.payLow;
}

function Cell({ label, on, blue = false }: { label: string; on: boolean; blue?: boolean }) {
  const pct = Number(label.replace("%", ""));
  const backgroundColor = on ? (blue ? colors.creditsYes : offerColor(pct)) : colors.fill;
  const tone = on ? "ink" : "muted";
  return (
    <View style={[styles.cell, { backgroundColor }]}>
      <Text role="caption" tone={tone}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.paper },
  head: { height: 56, flexDirection: "row", alignItems: "center", paddingLeft: space.lg },
  title: { flex: 1 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  tools: { flexDirection: "row", alignItems: "center", gap: space.sm, marginHorizontal: space.lg, marginBottom: space.sm },
  search: { flex: 1, minHeight: 44, borderRadius: radius.field, backgroundColor: colors.fill, paddingHorizontal: space.md, color: colors.ink },
  filter: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.sm },
  group: { paddingHorizontal: space.lg, paddingTop: space.md },
  choice: { minHeight: 48, marginHorizontal: space.md, paddingHorizontal: space.md, borderRadius: radius.field, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  choiceOn: { backgroundColor: colors.fill },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: colors.border },
  dotOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  bar: { flexDirection: "row", alignItems: "center", backgroundColor: colors.ink, paddingVertical: space.sm, paddingHorizontal: space.lg, gap: space.sm },
  barName: { flex: 1 },
  barCell: { width: 56, textAlign: "center" },
  payHead: { width: 64, textAlign: "center" },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm, gap: space.xs },
  payRow: { minHeight: 72, flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, gap: space.lg },
  name: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm },
  nameText: { flex: 1 },
  bonus: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  offers: { flexDirection: "row", gap: space.lg },
  cell: { width: 64, height: 44, borderRadius: radius.field, alignItems: "center", justifyContent: "center" },
  note: { padding: space.lg },
});
