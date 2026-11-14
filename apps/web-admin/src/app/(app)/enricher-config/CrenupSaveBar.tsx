"use client";

import { SaveBar } from "@/components/admin-ui";

/** @deprecated use { SaveBar } from "@/components/admin-ui" (Wave 1 wrapper, MESITA-3948). */
export function CrenupSaveBar({
  blocked,
  settingsStamp,
  ...rest
}: {
  blocked: string | null;
  dirty: boolean;
  ok: boolean;
  pending: boolean;
  settingsStamp: string | null;
  error: string | null;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return <SaveBar loadError={blocked} lastChanged={settingsStamp} {...rest} />;
}
