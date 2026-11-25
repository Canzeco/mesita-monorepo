import * as Updates from "expo-updates";
import { useEffect, useState } from "react";

import { EdgeError } from "@/lib/edge";

export type ErrorCopy = { offline: boolean; message: string; requestId: string | null };

export function errorCopy(err: unknown, updateAvailable: boolean): ErrorCopy {
  if (!(err instanceof EdgeError)) return { offline: false, message: "Something went wrong.", requestId: null };
  const offline = err.code === "network";
  if (err.kind === "unreadable") {
    const message = updateAvailable
      ? "This screen needs the newer version of Mesita."
      : "Something changed on our side. Try again in a moment.";
    return { offline, message, requestId: err.requestId };
  }
  return { offline, message: err.message, requestId: err.requestId };
}

/** What to tell the guest about a failed read. Says "update" only when there is one. */
export function useErrorCopy(err: unknown): ErrorCopy {
  const unreadable = err instanceof EdgeError && err.kind === "unreadable";
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!unreadable || !Updates.isEnabled) return;
    let live = true;
    Updates.checkForUpdateAsync().then(
      (found) => live && setAvailable(found.isAvailable),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [unreadable]);
  return errorCopy(err, available);
}
