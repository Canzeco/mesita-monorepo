"use client";

import { useEffect } from "react";

// Self-updating guard against deployment skew. The JS a user has in memory is
// frozen at whenever the page first loaded, so after a new production deploy an
// already-open tab / installed PWA / bfcache-restored page keeps rendering old
// code until a FULL reload — which is exactly why shipped changes "don't show
// up" even though consumer.mesita.ai already serves the new build.
//
// The pipeline (GitHub → Vercel → domain) delivers new builds within seconds;
// this makes open sessions actually pick them up. The bundle bakes in its build
// sha (NEXT_PUBLIC_BUILD_SHA); /api/version runs on the live deployment so it
// reports the CURRENT sha. When the user returns to the app we compare them — a
// mismatch means a newer build shipped, so we hard-reload once onto it.
//
// Safe by design: only checks when the app regains visibility/focus (never
// interrupts active use), and can't loop — after the reload the fresh bundle's
// sha matches the live one. In local dev the sha is "dev" and it's a no-op.
const LOADED_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";

export function DeploymentWatcher() {
  useEffect(() => {
    if (LOADED_SHA === "dev") return;

    let checking = false;
    const checkForUpdate = async () => {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { sha } = (await res.json()) as { sha?: string };
        if (sha && sha !== "dev" && sha !== LOADED_SHA) {
          // A newer production build is live — jump onto it.
          window.location.reload();
        }
      } catch {
        // Offline / transient — ignore; we retry on the next refocus.
      } finally {
        checking = false;
      }
    };

    const onActive = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };
    document.addEventListener("visibilitychange", onActive);
    window.addEventListener("focus", onActive);
    return () => {
      document.removeEventListener("visibilitychange", onActive);
      window.removeEventListener("focus", onActive);
    };
  }, []);

  return null;
}
