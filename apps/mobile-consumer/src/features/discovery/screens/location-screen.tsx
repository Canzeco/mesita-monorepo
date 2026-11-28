import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { Text } from "@/components/text";
import { Window } from "@/components/window";
import { useSession } from "@/features/auth";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, maxFontSizeMultiplier, pressedStyle, radius, type } from "@/theme";

import { useActiveLocation } from "../location-context";
import { DISTRITO_TEC, type Point } from "../model";
import { useLocationSearch, useResolveLocation, useSavePin, useSavedPins } from "../queries";

const FIX_MS = 10_000;

/** The phone's place now; with no fix in ten seconds (indoors, a phone that
 *  never got one), the last it knew. Throws when there is neither. */
export async function findDevice(): Promise<Location.LocationObject> {
  const request = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
  // A simulator often delivers the fix just after the first wait. Keep the
  // same request; a second call starts over and misses it.
  const first = await firstOf(request, FIX_MS);
  if (first) return first;
  const last = await Location.getLastKnownPositionAsync();
  if (last) return last;
  const late = await firstOf(request, FIX_MS);
  if (late) return late;
  throw new Error("no location");
}

function firstOf<T>(pending: Promise<T | null>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<null>((done) => {
    timer = setTimeout(() => done(null), ms);
  });
  return Promise.race([pending, slow]).finally(() => clearTimeout(timer));
}

const HERE = "Current location";

type Device = "idle" | "asking" | "denied" | "failed";
const HELP: Partial<Record<Device, string>> = {
  denied: "Location is off for Mesita. Tap to open Settings.",
  failed: "Your device couldn't find you. Turn on Location Services, then tap Use my location.",
};

/** Where Home looks from: the phone's own place, or one typed in. */
export function LocationScreen({ onDone, onSignIn }: { onDone: () => void; onSignIn: () => void }) {
  const member = useSession().guestId !== null;
  const { location, choose } = useActiveLocation();
  const [device, setDevice] = useState<Device>("idle");
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  const [sessionToken] = useState(() => Crypto.randomUUID());
  const search = useLocationSearch(input, sessionToken, member);
  const resolve = useResolveLocation();
  const pins = useSavedPins(member);
  const save = useSavePin();
  const failed = resolve.error ?? search.error ?? save.error;
  const copy = useErrorCopy(failed);

  const done = (point: Point, name: string) => {
    choose({ ...point, name });
    onDone();
  };

  // Asked at the moment of use, never at launch. Approximate is enough.
  const locate = async () => {
    if (device === "denied") return void Linking.openSettings();
    setDevice("asking");
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return setDevice("denied");
      const { coords } = await findDevice();
      done({ lat: coords.latitude, lng: coords.longitude }, HERE);
    } catch {
      setDevice("failed");
    }
  };

  const here = location?.name === HERE;
  return (
    <Window title="Location" label="Location" onClose={onDone}>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {member ? (
          <View style={styles.search}>
            <View style={styles.box}>
              <Icon strokeWidth={2.25} name="search" size={16} color={colors.muted} />
              <TextInput
                accessibilityLabel="Search a location"
                placeholder="Search a city, neighborhood or address"
                placeholderTextColor={colors.muted}
                maxFontSizeMultiplier={maxFontSizeMultiplier}
                value={input}
                onChangeText={setInput}
                autoCorrect={false}
                testID="location-input"
                style={styles.input}
              />
            </View>
          </View>
        ) : null}
        {input.trim().length >= 3 ? (
          (search.data ?? []).length === 0 ? (
            <Text role="body" tone="muted" style={styles.error}>{search.isFetching ? "Searching…" : "No matches yet"}</Text>
          ) : (search.data ?? []).map((s) => (
            <LocationRow
              key={s.placeId}
              icon="map-pin"
              title={s.mainText}
              line={s.secondaryText ?? null}
              busy={resolve.isPending && resolve.variables === s.placeId}
              onPress={() =>
                resolve.mutate(s.placeId, {
                  onSuccess: (point) => {
                    if (!adding) return done(point, s.mainText);
                    const pin = {
                      id: Crypto.randomUUID(),
                      lat: point.lat,
                      lng: point.lng,
                      name: s.mainText,
                      line: s.secondaryText ?? null,
                    };
                    save.mutate(pin, { onSuccess: () => done(pin, pin.name) });
                  },
                })
              }
            />
          ))
        ) : (
          <>
            <LocationRow
              icon="navigation"
              title={device === "asking" ? "Locating…" : here ? HERE : "Use my location"}
              line={HELP[device] ?? "Tap to share where you are"}
              alert={HELP[device] !== undefined}
              busy={device === "asking"}
              chosen={here}
              onPress={() => void locate()}
              testID="use-device"
            />
            {(pins.data ?? []).map((pin) => (
              <LocationRow
                key={pin.id}
                icon="map-pin"
                title={pin.name}
                line={pin.line}
                chosen={location?.name === pin.name && location.lat === pin.lat && location.lng === pin.lng}
                onPress={() => done(pin, pin.name)}
              />
            ))}
            <LocationRow
              icon="map-pin"
              title={DISTRITO_TEC.name}
              line="Monterrey"
              chosen={location?.name === DISTRITO_TEC.name}
              onPress={() => done(DISTRITO_TEC, DISTRITO_TEC.name)}
              testID="distrito-tec"
            />
            {member ? (
              <LocationRow
                icon="mark"
                title="Add a location"
                line={(pins.data?.length ?? 0) >= 8 ? "8 saved · remove one first" : "Home, work — any spot on the map"}
                onPress={() => setAdding(true)}
                testID="add-location"
              />
            ) : null}
            {member ? null : (
              <LocationRow
                icon="log-in"
                title="Sign in to search any place"
                line="Then search a city or save a spot"
                onPress={onSignIn}
              />
            )}
          </>
        )}
        {failed ? (
          <Text role="caption" tone="danger" style={styles.error}>
            {copy.offline ? "No connection." : copy.message}
          </Text>
        ) : null}
      </ScrollView>
    </Window>
  );
}

type RowProps = {
  icon: IconName;
  title: string;
  line: string | null;
  alert?: boolean;
  busy?: boolean;
  chosen?: boolean;
  onPress: () => void;
  testID?: string;
};

function LocationRow({ icon, title, line, alert = false, busy = false, chosen = false, onPress, testID }: RowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, line].filter(Boolean).join(". ")}
      accessibilityState={{ selected: chosen, busy }}
      disabled={busy}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && pressedStyle]}
    >
      <View style={[styles.disc, chosen && styles.discOn]}>
        {busy ? <Spinner /> : <Icon strokeWidth={2.25} name={icon} size={16} color={chosen ? colors.onInk : colors.ink} />}
      </View>
      <View style={styles.words}>
        <Text role="label">{title}</Text>
        {line ? (
          <Text role="caption" tone={alert ? "danger" : "muted"}>
            {line}
          </Text>
        ) : null}
      </View>
      {chosen ? <Icon strokeWidth={2.25} name="check" size={16} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: { padding: 20 },
  box: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
  },
  input: { ...type.small, flex: 1, color: colors.ink },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  disc: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.fill },
  discOn: { backgroundColor: colors.ink },
  words: { flex: 1, gap: 2 },
  error: { padding: 16 },
});
