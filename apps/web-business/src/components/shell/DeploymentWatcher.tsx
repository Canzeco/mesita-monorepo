"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { hasUnsavedEdits } from "@/lib/unsaved-edits";

// An open window runs the JS it loaded, so a shipped change "doesn't show up"
// while business.mesita.ai already serves it (MESITA-3181; web-consumer's
// watcher, MESITA-2777). The bundle bakes in its sha; /api/version reports the
// live one. A mismatch, checked when the window comes back, only marks this
// bundle stale: clicking into the window IS the focus, so reloading right then
// would eat that click. The reload waits for the next screen change or for the
// page to go hidden.
//
// Unlike a guest's app, this one holds forms. Neither reload runs over the
// editor's unsaved drafts, and the hidden one also waits while a field has
// focus (a half-typed invite or code). It can't loop: after the reload the
// bundle's sha matches. Locally the sha is "dev" and this does nothing.
const LOADED_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";

function fieldHasFocus(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLElement && (el.matches("input, textarea, select") || el.isContentEditable);
}

export function DeploymentWatcher() {
  const pathname = usePathname();
  const stale = useRef(false);
  const shownPath = useRef(pathname);

  // The URL is already the new screen's, so the reload lands there.
  useEffect(() => {
    if (pathname === shownPath.current) return;
    shownPath.current = pathname;
    if (stale.current && !hasUnsavedEdits()) window.location.reload();
  }, [pathname]);

  useEffect(() => {
    if (LOADED_SHA === "dev") return;

    let checking = false;
    const checkForUpdate = async () => {
      if (checking || stale.current) return;
      checking = true;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { sha } = (await res.json()) as { sha?: string };
        if (sha && sha !== "dev" && sha !== LOADED_SHA) stale.current = true;
      } catch {
        // Offline or transient: the next return to the window asks again.
      } finally {
        checking = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (stale.current && !hasUnsavedEdits() && !fieldHasFocus()) window.location.reload();
        return;
      }
      void checkForUpdate();
    };
    const onFocus = () => void checkForUpdate();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
}
