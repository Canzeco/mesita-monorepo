"use client";

import { useEffect } from "react";

const DEFAULT_INTERVAL_MS = 15_000;

/** Poll pay-notification EF data after Realtime RLS removal. */
export function usePayNotificationPoll(
  refresh: () => void | Promise<void>,
  enabled = true,
  intervalMs = DEFAULT_INTERVAL_MS,
) {
  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      void refresh();
    };

    const id = setInterval(tick, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, enabled, intervalMs]);
}
