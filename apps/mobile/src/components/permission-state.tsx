import { Linking } from "react-native";

import { Button } from "@/components/button";
import { Text } from "@/components/text";

/** A permission the guest refused: what it is for, and Open Settings. */
export function PermissionState({ message }: { message: string }) {
  return (
    <>
      <Text tone="muted">{message}</Text>
      <Button label="Open Settings" onPress={() => void Linking.openSettings()} />
    </>
  );
}
