"use client";

// Reservations Config — the Reservationist's operating limits.
//
// MINIMAL PAGE (Pato, 2026-08-21: "make this much simpler by far … simple and
// clean UI minimalist few words"; 2026-10-10, MESITA-2122: "remove stupid
// stuff"). ONE box: Testing, plus a Needs Attention card only when something
// needs attention. No Calls card, no fleet strip, no workflow diagram.
//
// STOP RENDERING, NEVER STOP CARRYING: `limits` (kill switch + daily caps),
// `reminder` and `respectAdminOverride` have no controls — the
// Edge Functions still read them at their seeds — and save spreads the whole
// object so they survive a write.
//
// WHOLE-BLOB save; `dirty` gates on loadError so a failed read can never
// overwrite the live singleton (MESITA-737).

import { useMemo, useState } from "react";
import { ErrorNote } from "@/components/ErrorNote";
import { SaveRow } from "@/components/admin-ui/config";
import { useConfigEditor } from "@/components/admin-ui/use-config-editor";
import { getReservationsConfig, updateReservationsConfig } from "./actions";
import { looksLikePhone, type NeedsAttentionRow, type ReservationsConfig } from "./catalog";
import { NeedsAttentionCard } from "./NeedsAttentionCard";
import { TestingCard } from "./TestingCard";

export function ReservationsConfigClient({
  initialConfig,
  initialNeedsAttention,
  loadError,
}: {
  initialConfig: ReservationsConfig;
  initialNeedsAttention: NeedsAttentionRow[];
  loadError: string | null;
}) {
  const [attention, setAttention] = useState<NeedsAttentionRow[]>(initialNeedsAttention);
  const { cfg, setCfg, saved, setOk, pending, error, loadBlocked, ok, saveWith } =
    useConfigEditor({
      initialConfig,
      loadError,
      load: getReservationsConfig,
      onLoaded: (r) => setAttention(r.needsAttention),
    });

  const testInvalid = cfg.testCall.enabled && !looksLikePhone(cfg.testCall.number);

  const dirty = useMemo(
    () => JSON.stringify(cfg) !== JSON.stringify(saved),
    [cfg, saved],
  );

  const patch = (next: Partial<ReservationsConfig>) => {
    setCfg((c) => ({ ...c, ...next }));
    setOk(false);
  };

  const save = () =>
    saveWith(async (c) => {
      const payload: ReservationsConfig = {
        ...c,
        testCall: { ...c.testCall, number: c.testCall.number.trim() },
      };
      return updateReservationsConfig(payload);
    });

  return (
    <div className="flex flex-col gap-4">
      <NeedsAttentionCard rows={attention} />
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
