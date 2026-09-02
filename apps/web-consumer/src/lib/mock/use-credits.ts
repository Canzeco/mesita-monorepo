"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGetControlsPolicy } from "@/lib/api/controls-config";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  CONTROLS_FALLBACK,
  type ControlsPolicy,
} from "./credits-mock";
import {
  emulatorAdvance,
  emulatorBuy,
  emulatorLoad,
  emulatorReset,
  emulatorSpend,
  type CreditsState,
  type EmulatorError,
  type Seed,
} from "./credits-emulator";

// React binding for the /credits emulator.
//
// State loads in an effect because it lives in localStorage, which does not
// exist during the server pass. That is also why the surface has a real loading
// state rather than a hydration mismatch.
//
// The minute tick exists so a countdown moves without a rerender per second. A
// lock is measured in hours; a per-second tick would be a rerender and a
// battery cost for information nobody acts on.
const TICK_MS = 60_000;

// THE POLICY IS REAL EVEN THOUGH THE BALANCES ARE NOT. The hold and the bonus
// come from app_config.controls_config via consumer-web-get-controls-config,
// so the admin console's Controls page actually governs this surface. The
// balances around them are still a browser emulator.
//
// The seed waits for the policy: a wallet seeded at the fallback and then
// re-seeded at the real hold would show two different countdowns in the first
// second. One fetch, then one seed.

export type CreditsApi = {
  state: CreditsState | null;
  /** Console-owned terms. Falls back to the shipped defaults if the read fails. */
  policy: ControlsPolicy;
  loading: boolean;
  busy: boolean;
  error: EmulatorError | null;
  /** Emulator time, already offset. Every maturation read derives from this. */
  nowMs: number;
  buy: (placeId: string, paidCents: number) => Promise<boolean>;
  spend: (balanceId: string, amountCents: number) => Promise<boolean>;
  advance: (hours: number) => void;
  reset: () => void;
  clearError: () => void;
};

export function useCredits(seed: Seed): CreditsApi {
  const supabase = useBrowserSupabase();
  const [policy, setPolicy] = useState<ControlsPolicy>(CONTROLS_FALLBACK);
  const [state, setState] = useState<CreditsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EmulatorError | null>(null);
  // Wall time is STATE, not a render-time read. Calling Date.now() during
  // render is impure — React may re-render at any moment and the value would
  // move under it — and the react-hooks/purity rule rejects it outright. The
  // tick below is what advances it.
  const [wallMs, setWallMs] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      // A failed policy read is not a failed wallet: the shipped defaults are
      // the same numbers the EF would have returned on a cold blob, so the
      // surface degrades to 3h rather than to an error.
      let resolved = CONTROLS_FALLBACK;
      try {
        resolved = await apiGetControlsPolicy(supabase);
      } catch {
        resolved = CONTROLS_FALLBACK;
      }
      if (!alive) return;
      setPolicy(resolved);
      const loaded = await emulatorLoad(seed, resolved);
      if (!alive) return;
      setState(loaded);
      setWallMs(Date.now());
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [seed, supabase]);

  useEffect(() => {
    const t = setInterval(() => setWallMs(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  const buy = useCallback(
    async (placeId: string, paidCents: number) => {
      if (!state) return false;
      setBusy(true);
      const result = await emulatorBuy(state, placeId, paidCents, policy);
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      setState(result.value);
      setWallMs(Date.now());
      return true;
    },
    [state, policy],
  );

  const spend = useCallback(
    async (balanceId: string, amountCents: number) => {
      if (!state) return false;
      setBusy(true);
      const result = await emulatorSpend(state, balanceId, amountCents);
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      setState(result.value);
      setWallMs(Date.now());
      return true;
    },
    [state],
  );

  const advance = useCallback(
    (hours: number) => {
      if (!state) return;
      setState(emulatorAdvance(state, hours));
      setWallMs(Date.now());
    },
    [state],
  );

  const reset = useCallback(() => {
    setState(emulatorReset(seed, policy));
    setWallMs(Date.now());
    setError(null);
  }, [seed, policy]);

  return {
    state,
    policy,
    loading,
    busy,
    error,
    // Pure: both halves are state. Null before the first load, which only the
    // loading branch renders.
    nowMs: (wallMs ?? 0) + (state?.clockOffsetMs ?? 0),
    buy,
    spend,
    advance,
    reset,
    clearError: () => setError(null),
  };
}

export function errorMessage(error: EmulatorError): string {
  switch (error) {
    case "unknown-place":
      return "That place isn't on Mesita.";
    case "unknown-balance":
      return "That balance no longer exists.";
    case "balance-locked":
      return "These Credits haven't unlocked yet.";
    case "insufficient-credits":
      return "You don't have that many Credits here.";
    case "amount-not-positive":
      return "Pick an amount first.";
  }
}
