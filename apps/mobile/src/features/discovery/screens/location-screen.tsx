import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import { useState } from "react";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Field, FieldError } from "@/components/field";
import { PermissionState } from "@/components/permission-state";
import { Row } from "@/components/row";
import { Screen } from "@/components/screen";
import { SignInInvite } from "@/components/sign-in-invite";
import { useSession } from "@/features/auth";
import { useErrorCopy } from "@/lib/error-copy";

import { useActiveLocation } from "../location-context";
import type { Point } from "../model";
import { useLocationSearch, useResolveLocation } from "../queries";

/** Where Home looks from: the phone's own place, or one typed in. */
export function LocationScreen({ onDone, onSignIn }: { onDone: () => void; onSignIn: () => void }) {
  const member = useSession().guestId !== null;
  const { choose } = useActiveLocation();
  const [device, setDevice] = useState<"idle" | "asking" | "denied" | "failed">("idle");
  const [input, setInput] = useState("");
  const [sessionToken] = useState(() => Crypto.randomUUID());
  const search = useLocationSearch(input, sessionToken, member);
  const resolve = useResolveLocation();
  const failed = resolve.error ?? search.error;
  const copy = useErrorCopy(failed);

  const done = (point: Point, name: string) => {
    choose({ ...point, name });
    onDone();
  };

  // Asked at the moment of use, never at launch. Approximate is enough.
  const locate = async () => {
    setDevice("asking");
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return setDevice("denied");
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      done({ lat: coords.latitude, lng: coords.longitude }, "Current location");
    } catch {
      setDevice("failed");
    }
  };

  return (
    <Screen>
      {device === "denied" ? (
        <PermissionState message="Mesita uses your location to show the places near you." />
      ) : (
        <Button
          label="Use my current location"
          busy={device === "asking"}
          onPress={() => void locate()}
          testID="use-device"
        />
      )}
      {device === "failed" ? <FieldError>Your location could not be found. Try again.</FieldError> : null}
      {member ? (
        <Field
          label="Or type a city or area"
          value={input}
          onChangeText={setInput}
          autoCorrect={false}
          testID="location-input"
        />
      ) : (
        <SignInInvite message="Sign in to choose another city or area." onSignIn={onSignIn} />
      )}
      {search.data?.length ? (
        <Card>
          {search.data.map((s) => (
            <Row
              key={s.placeId}
              label={s.mainText}
              value={s.secondaryText ?? undefined}
              onPress={() => resolve.mutate(s.placeId, { onSuccess: (point) => done(point, s.mainText) })}
            />
          ))}
        </Card>
      ) : null}
      {failed ? <FieldError>{copy.offline ? "No connection." : copy.message}</FieldError> : null}
    </Screen>
  );
}
