"use client";

// The reserve form's plan state (MESITA-4393): one read of the guest's plan
// (consumer-web-get-plan, `light` so it skips Stripe), the hidden Pro step,
// the Upgrade round trip through Stripe Checkout and the draft that keeps
// the half-made booking across it. The rules are pure (lib/reserve-plan.ts);
// this hook only holds state and talks to the browser.
//
//   mount ──► read ?pro / ?plan once (ref; Strict Mode runs effects twice)
//         ──► apiGetPlan(sessionId?, { light }) ──► view
//                 └─ draft (sessionStorage) applied in this callback
//         ──► 3 s without an answer: settled anyway (fail open)
//   Upgrade ─► save draft ─► replaceState ?pro=1 ─► startUpgrade ─► Stripe
//   back    ─► ?pro=1[&plan=cs_…] ─► returnOutcome ─► You / Pro / form
//   bfcache ─► pageshow(persisted): busy off, plan re-read

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { apiGetPlan, type GuestPlanView } from "@/lib/api/plan";
import {
  blocked,
  capApplies,
  decodeDraft,
  draftKey,
  encodeDraft,
  offerPro,
  proReturnUrl,
  returnOutcome,
  type ReserveDraft,
} from "@/lib/reserve-plan";
import { startUpgrade } from "@/lib/start-upgrade";

/** How long the You step waits for the plan before Reserve works anyway. */
const FAIL_OPEN_MS = 3000;

const NOT_PAID = "Your payment didn't go through. Try again.";

type Marker = { pro: boolean; sessionId: string | null };

/** The return markers, read once and stripped so a reload does not repeat
 *  the return. */
function takeMarker(): Marker {
  if (typeof window === "undefined") return { pro: false, sessionId: null };
  const url = new URL(window.location.href);
  const pro = url.searchParams.get("pro") === "1";
  const raw = url.searchParams.get("plan");
  const sessionId = raw && /^cs_[A-Za-z0-9_]+$/.test(raw) ? raw : null;
  if (pro || raw) {
    url.searchParams.delete("pro");
    url.searchParams.delete("plan");
    window.history.replaceState(window.history.state, "", url.toString());
  }
  return { pro, sessionId };
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function useReservePlan(args: {
  supabase: SupabaseClient;
  placeId: string;
  checking: boolean;
  hasLiveTable: boolean;
  /** Fill the form from a restored draft. */
  applyDraft: (draft: ReserveDraft) => void;
}) {
  const { supabase, placeId, applyDraft } = args;
  const [view, setView] = useState<GuestPlanView | null>(null);
  const [settled, setSettled] = useState(false);
  const [pro, setPro] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [paid, setPaid] = useState(false);
  const marker = useRef<Marker | null>(null);
  const sessionRef = useRef<string | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const applyRef = useRef(applyDraft);
  useEffect(() => {
    applyRef.current = applyDraft;
  }, [applyDraft]);

  const read = useCallback(
    async (sessionId: string | null): Promise<GuestPlanView | null> => {
      try {
        return await apiGetPlan(supabase, sessionId ?? undefined, {
          light: !sessionId,
        });
      } catch {
        return null;
      }
    },
    [supabase],
  );

  // The mount read, once. A return from Checkout reads with its session id.
  useEffect(() => {
    if (!marker.current) marker.current = takeMarker();
    const { pro: hasProMarker, sessionId } = marker.current;
    sessionRef.current = sessionId;
    let live = true;
    const timer = setTimeout(() => {
      if (live) setSettled(true);
    }, FAIL_OPEN_MS);
    void read(sessionId).then((v) => {
      if (!live) return;
      clearTimeout(timer);
      setView(v);
      setSettled(true);
      if (!hasProMarker && !sessionId) return;
      // Back from Checkout: restore the draft, then land where the
      // outcome says.
      const store = storage();
      let raw: string | null = null;
      try {
        raw = store?.getItem(draftKey(placeId)) ?? null;
        store?.removeItem(draftKey(placeId));
      } catch {
        raw = null;
      }
      const draft = decodeDraft(raw, Date.now());
      if (draft) applyRef.current(draft);
      const outcome = returnOutcome({
        hasProMarker,
        sessionId,
        view: v,
        readFailed: v === null,
      });
      if (outcome.kind === "paid") {
        setPaid(true);
        setPro(false);
      } else if (outcome.kind === "pending") {
        setPending(true);
        setPro(true);
      } else if (outcome.kind === "failed") {
        sessionRef.current = null;
        setError(NOT_PAID);
        setPro(true);
      } else if (outcome.kind === "check_failed") {
        setError("Couldn't check your payment. Try again.");
        setCheckFailed(true);
        setPro(true);
      } else if (outcome.kind === "offer") {
        setPro(true);
      }
    });
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [read, placeId]);

  // Back from Checkout out of the browser's back-forward cache: the page
  // keeps its memory, so nothing above runs again. Unstick it.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setBusy(false);
      setError(null);
      void read(null).then((v) => {
        if (v) setView(v);
      });
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [read]);

  /** Re-read the plan (Try again, a refusal at submit, a resumed Pro). */
  const reread = useCallback(async (): Promise<GuestPlanView | null> => {
    const v = await read(sessionRef.current);
    if (v) setView(v);
    return v;
  }, [read]);

  async function retryPayment() {
    setError(null);
    const v = await reread();
    if (!v) {
      setError("Couldn't check your payment. Try again.");
      return;
    }
    setCheckFailed(false);
    if (v.confirmed === "failed") sessionRef.current = null;
    if (v.confirmed === "failed" && v.plan !== "premium") {
      setPending(false);
      setError(NOT_PAID);
      return;
    }
    if (v.confirmed === "paid" || (v.confirmed !== "pending" && v.plan === "premium")) {
      setPending(false);
      setPaid(true);
      setPro(false);
    }
  }

  /** Save the draft, then go to Checkout. */
  async function upgrade(draft: Omit<ReserveDraft, "savedAt">) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      try {
        storage()?.setItem(
          draftKey(placeId),
          encodeDraft({ ...draft, savedAt: Date.now() }),
        );
      } catch {
        // No draft (private mode, quota): Checkout still works.
      }
      const back = proReturnUrl(window.location.href);
      // The browser's Back from Checkout lands on this entry: mark it too.
      window.history.replaceState(window.history.state, "", back);
      const res = await startUpgrade(supabase, back);
      if (res.kind === "redirect") {
        window.location.assign(res.url);
        return;
      }
      if (res.kind === "error") {
        setError(res.message);
        return;
      }
      // resumed or already Pro: nothing to pay; read again and go back.
      await reread();
      setPro(false);
    } finally {
      setBusy(false);
    }
  }

  function clearDraft() {
    try {
      storage()?.removeItem(draftKey(placeId));
    } catch {
      // nothing to clear
    }
  }

  const applies = capApplies({
    view,
    checking: args.checking,
    hasLiveTable: args.hasLiveTable,
  });
  return {
    view,
    settled,
    applies,
    offer: applies && offerPro(view),
    isBlocked: applies && blocked(view),
    // The Pro step shows while Pro still helps, or while a payment is
    // being checked (pending or a failed check).
    pro: pro && ((applies && offerPro(view)) || pending || checkFailed),
    checkFailed,
    setPro,
    busy,
    error,
    setError,
    pending,
    paid,
    upgrade,
    reread,
    retryPayment,
    clearDraft,
  };
}
