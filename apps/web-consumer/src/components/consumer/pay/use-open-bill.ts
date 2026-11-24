"use client";

import { useEffect, useState } from "react";
import { apiGetPayCode, billNeedsGuest, type GuestBill } from "@/lib/api/pay-bill";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";

/** The guest's one open bill (MESITA-4823): read when the screen opens and
 *  again whenever the app comes back to the front. undefined = not read yet;
 *  a failed read is null (the QR screen reads it again). */
export function useOpenBill(on = true): GuestBill | null | undefined {
  const getSupabase = useLazyBrowserSupabase();
  const [bill, setBill] = useState<GuestBill | null | undefined>(undefined);
  useEffect(() => {
    if (!on) return;
    let alive = true;
    const read = () =>
      void apiGetPayCode(getSupabase())
        .then((r) => {
          if (alive) setBill(billNeedsGuest(r.bill) ? r.bill : null);
        })
        .catch(() => {
          if (alive) setBill((b) => b ?? null);
        });
    read();
    const onVisible = () => {
      if (document.visibilityState === "visible") read();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [on, getSupabase]);
  return bill;
}
