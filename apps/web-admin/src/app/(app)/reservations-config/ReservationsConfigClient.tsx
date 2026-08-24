"use client";

// Reservations Config — the Reservationist's operating limits.
//
// MINIMAL PAGE (Pato, 2026-08-21: "make this much simpler by far … simple and
// clean UI minimalist few words"). TWO boxes: Calls · Testing. Kill switch
// leads. A one-line fleet strip names a1–a4; no workflow diagram.
//
// STOP RENDERING, NEVER STOP CARRYING still applies: `attempts` (fixed at 2 by
// protocol), the phone-only channel shape, and the legacy `consumerNumber` have
// no controls, and save spreads the whole object so they survive a write.
//
// WHOLE-BLOB save; `dirty` gates on loadError so a failed read can never
// overwrite the live singleton (MESITA-737).

import { useEffect, useMemo, useState, useTransition } from "react";
import { ErrorNote } from "@/components/ErrorNote";
import { SaveRow } from "@/components/admin-ui/config";
import { getReservationsConfig, updateReservationsConfig } from "./actions";
import { looksLikePhone, type NeedsAttentionRow, type ReservationsConfig } from "./catalog";
import { CallsCard } from "./CallsCard";
import { NeedsAttentionCard } from "./NeedsAttentionCard";
import { TestingCard } from "./TestingCard";

const PHONE_ONLY_CHANNELS: Pick<ReservationsConfig, "priority" | "disabled"> = {
  priority: ["phone"],
  disabled: [],
};

export function ReservationsConfigClient({
  initialConfig,
  initialUpdatedAt,
  initialNeedsAttention,
  loadError,
}: {
  initialConfig: ReservationsConfig;
  initialUpdatedAt: string | null;
  initialNeedsAttention: NeedsAttentionRow[];
  loadError: string | null;
}) {
  const [cfg, setCfg] = useState<ReservationsConfig>(initialConfig);
  const [saved, setSaved] = useState<ReservationsConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [loadBlocked, setLoadBlocked] = useState(!!loadError);
  const [ok, setOk] = useState(false);
  const [, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [attention, setAttention] = useState<NeedsAttentionRow[]>(initialNeedsAttention);

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getReservationsConfig();
      if (!active) return;
      if (!r.ok) {
        if (loadBlocked) setError(r.error);
        return;
      }
      setCfg(r.config);
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setAttention(r.needsAttention);
      setLoadBlocked(false);
      setError(null);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, []);

  const testInvalid = cfg.testCall.enabled && !looksLikePhone(cfg.testCall.number);

  const dirty = useMemo(
    () => JSON.stringify(cfg) !== JSON.stringify(saved),
    [cfg, saved],
  );

  const patch = (next: Partial<ReservationsConfig>) => {
    setCfg((c) => ({ ...c, ...next }));
    setOk(false);
  };

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    const payload: ReservationsConfig = {
      ...cfg,
      ...PHONE_ONLY_CHANNELS,
      testCall: { ...cfg.testCall, number: cfg.testCall.number.trim() },
    };
    startTransition(async () => {
      const r = await updateReservationsConfig(payload);
      if (r.ok) {
        setSaved(r.config);
        setCfg(r.config);
        setUpdatedAt(r.updatedAt);
        setOk(true);
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <NeedsAttentionCard rows={attention} />
      <CallsCard cfg={cfg} pending={pending} patch={patch} />
      <TestingCard cfg={cfg} pending={pending} testInvalid={testInvalid} patch={patch} />
      <SaveRow
        pending={pending}
        dirty={dirty && !testInvalid}
        ok={ok}
        onClick={save}
        loadError={loadBlocked ? (error ?? "Failed to load Reservations config") : null}
      />
      {error && <ErrorNote message={error} />}
    </div>
  );
}
