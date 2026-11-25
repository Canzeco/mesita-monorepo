import { Linking } from "react-native";

import { EmptyState } from "@/components/empty-state";

/** A permission the guest refused: what it is for, and Open Settings. */
export function PermissionState({ message }: { message: string }) {
  return <EmptyState message={message} action={{ label: "Open Settings", onPress: () => void Linking.openSettings() }} />;
}
