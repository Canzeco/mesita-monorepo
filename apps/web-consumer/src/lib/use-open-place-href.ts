"use client";

// Opening a place from a tap, so the tap can never be swallowed
// (MESITA-2816): the one navigation guard in lib/navigate.ts, bound to the
// router. Every place open (a Mesita card, a Google-only card's opening
// screen, Ask AI's answer) calls this, never a bare router.push.

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { navigateTo } from "@/lib/navigate";

export { NAV_FALLBACK_MS } from "@/lib/navigate";

export function useOpenPlaceHref(): (href: string) => void {
  const router = useRouter();
  return useCallback((href: string) => navigateTo(router, href), [router]);
}
