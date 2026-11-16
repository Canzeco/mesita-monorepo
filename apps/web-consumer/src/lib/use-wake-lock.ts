"use client";

import { useEffect } from "react";

/** Keeps the screen on while a QR waits to be scanned, where the browser can
 *  (the bill at the table since MESITA-3564; the guest's Sign step since
 *  MESITA-4131: the phone locked while the guest waited for the waiter). The
 *  browser drops the lock when the page hides, so it is taken again on
 *  coming back. */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const take = () => {
      void (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock
        .request("screen")
        .then((l) => {
          if (cancelled) void l.release().catch(() => {});
          else lock = l;
        })
        .catch(() => {});
    };
    take();
    const onVisible = () => {
      if (!document.hidden) take();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (lock) void lock.release().catch(() => {});
    };
  }, [on]);
}
