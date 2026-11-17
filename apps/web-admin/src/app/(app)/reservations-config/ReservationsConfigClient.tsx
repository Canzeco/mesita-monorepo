"use client";

// Reservations Config — the Reservationist's operating limits.
//
// MINIMAL PAGE (Pato, 2026-08-21: "make this much simpler by far … simple and
// clean UI minimalist few words"; 2026-10-10, MESITA-2122: "remove stupid
// stuff"). ONE box: Testing. Needs attention moved to Logs (MESITA-4293:
// no logs on a Configurations page). No Calls card, no fleet strip, no workflow diagram.
//
// STOP RENDERING, NEVER STOP CARRYING: `limits` (kill switch + daily caps)
// and `reminder` have no controls — the Edge Functions still read them at
// their seeds — and save spreads the whole object so they survive a write.
//
// WHOLE-BLOB save; `dirty` gates on loadError so a failed read can never
// overwrite the live singleton (MESITA-737).

import { useMemo } from "react";
import { Notice } from "@/components/admin-ui";
import { SaveRow } from "@/components/admin-ui/config";
import { useConfigEditor } from "@/components/admin-ui/use-config-editor";
import { getReservationsConfig, updateReservationsConfig } from "./actions";
import { type ReservationsConfig, testNumberInvalid } from "./catalog";
import { TestingCard } from "./TestingCard";

export function ReservationsConfigClient({
  initialConfig,
  loadError,
}: {
  initialConfig: ReservationsConfig;
  loadError: string | null;
}) {
  const {
    cfg,
    setCfg,
    saved,
    setOk,
    pending,
    error,
    loadBlocked,
    ok,
    saveWith,
  } = useConfigEditor({
    initialConfig,
    loadError,
    load: getReservationsConfig,
  });

  const testInvalid = testNumberInvalid(cfg.testCall);

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
      <TestingCard
        cfg={cfg}
        pending={pending}
        testInvalid={testInvalid}
        patch={patch}
      />
      <SaveRow
        pending={pending}
        dirty={dirty && !testInvalid}
        ok={ok}
        onClick={save}
        loadError={
          loadBlocked ? (error ?? "Failed to load Reservations config") : null
        }
      />
      {error && <Notice className="mt-4">{error}</Notice>}
    </div>
  );
}
