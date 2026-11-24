"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { routeFor, type RouteId } from "@/lib/consumer-route-contract";

// Self-updating guard against deployment skew. The JS a user has in memory is
// frozen at whenever the page first loaded, so after a new production deploy an
// already-open tab / installed PWA / bfcache-restored page keeps rendering old
// code until a FULL reload — which is exactly why shipped changes "don't show
// up" even though mesita.ai already serves the new build.
//
// The pipeline (GitHub → Vercel → domain) delivers new builds within seconds;
// this makes open sessions actually pick them up. The bundle bakes in its build
// sha (NEXT_PUBLIC_BUILD_SHA); /api/version runs on the live deployment so it
// reports the CURRENT sha. When the user returns to the app we compare them — a
// mismatch means a newer build shipped.
//
// A NEWER BUILD NEVER RELOADS UNDER THE GUEST'S FINGER (MESITA-2777). The check
// runs on focus, and clicking into the window IS the focus: reloading the
// moment the answer came back wiped whatever that click opened ~200ms later,
// so Search's Filters chip "did nothing" and bottom-bar taps read as dead
// (MESITA-2762). A stale bundle now only marks itself; the reload waits for the
// next change to a browse screen (it loads on the new build) or for the page
// to go hidden on one, when nobody is looking. It can't loop — after the reload the
// fresh bundle's sha matches the live one. In local dev the sha is "dev" and
// it's a no-op.
const LOADED_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";

// ONLY A BROWSE SCREEN RELOADS. Anything else can hold work a reload would
// lose (a bill, a checkout, a reservation, sign-in, a form), so a stale build
// there waits until the guest is back on one of these.
const BROWSE: ReadonlySet<RouteId> = new Set<RouteId>([
  "home",
  "homeSocial",
  "search",
  "place",
  "me",
  "meNotifications",
  "meReservations",
  "meReservationsPast",
  "meTickets",
  "meTicketsKind",
]);

/** Nothing on this screen is in progress, so a reload loses nothing. */
function canReload(): boolean {
  const route = routeFor(window.location.pathname);
  if (!route || !BROWSE.has(route)) return false;
  // Reading the texted code hides the page: keep the code step.
  if (document.querySelector('input[autocomplete="one-time-code"]')) return false;
  // An open dialog (a filter, a saved pin, Generate) is work too.
  if (document.querySelector('[role="dialog"][aria-modal="true"]')) return false;
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return true;
  return !el.isContentEditable && !el.matches("input, textarea, select");
}

export function DeploymentWatcher() {
  const pathname = usePathname();
  const stale = useRef(false);
  const shownPath = useRef(pathname);

  // The next screen change, once stale: the URL is already the new screen's,
  // so the reload lands there on the new build.
  useEffect(() => {
    if (pathname === shownPath.current) return;
    shownPath.current = pathname;
    if (stale.current && canReload()) window.location.reload();
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
        // Offline / transient — ignore; we retry on the next refocus.
      } finally {
        checking = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (stale.current && canReload()) window.location.reload();
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
