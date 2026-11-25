import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { Linking, Platform } from "react-native";

import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { variant } from "@/lib/build";
import { plain } from "@/lib/storage";

export type UpdateState = "downloading" | "failed" | "store";

const TRIED = "mesita.update.tried";

// Before a store release exists a tester's build comes from TestFlight or the
// APK page of its Expo project.
const PAGE =
  variant === "production"
    ? Platform.select({
        ios: "https://apps.apple.com/search?term=mesita",
        default: "market://details?id=com.mesita.consumer",
      })
    : Platform.select({
        ios: "itms-beta://",
        default: "https://expo.dev/accounts/canzeco/projects/mesita-mobile-consumer/builds",
      });

/** Apply the waiting update. Never a loop: the same update is tried once, and
 *  after one crashed on launch the store is the only way. */
export async function applyUpdate(): Promise<"reloading" | "failed" | "store"> {
  if (!Updates.isEnabled || Updates.isEmergencyLaunch) return "store";
  try {
    const found = await Updates.checkForUpdateAsync();
    if (!found.isAvailable) return "store";
    const id = String((found.manifest as { id?: unknown } | undefined)?.id ?? "");
    if (id && (await plain.get(TRIED)) === id) return "store";
    await Updates.fetchUpdateAsync();
    await plain.set(TRIED, id);
    await Updates.reloadAsync();
    return "reloading";
  } catch {
    return "failed";
  }
}

export function UpdateScreen() {
  const [state, setState] = useState<UpdateState>("downloading");
  const [tries, setTries] = useState(0);
  useEffect(() => {
    let live = true;
    void applyUpdate().then((end) => {
      if (live && end !== "reloading") setState(end);
    });
    return () => {
      live = false;
    };
  }, [tries]);
  const retry = () => {
    setState("downloading");
    setTries((n) => n + 1);
  };
  return <UpdateView state={state} onRetry={retry} onStore={() => void Linking.openURL(PAGE)} />;
}

const WORDS: Record<UpdateState, string> = {
  downloading: "Getting the newest version.",
  failed: "The update could not be downloaded.",
  store: "This version is too old to continue.",
};

export function UpdateView(props: { state: UpdateState; onRetry: () => void; onStore: () => void }) {
  const { state, onRetry, onStore } = props;
  return (
    <Screen center>
      <Text role="title">Update Mesita</Text>
      <Text tone="muted">{WORDS[state]}</Text>
      {state === "failed" ? <Button label="Try again" onPress={onRetry} /> : null}
      {state === "downloading" ? null : (
        <Button kind={state === "failed" ? "secondary" : "primary"} label="Open the store" onPress={onStore} />
      )}
    </Screen>
  );
}
