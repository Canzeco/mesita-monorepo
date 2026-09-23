// The whole-blob config editor behind Controls, Visits, Reservations and
// Discovery's Map, Families and source floors: the seven pieces of state, the
// mount re-fetch, and the save tail that adopts what the server wrote. MESITA-737: a failed server load blocks Save until a mount
// re-fetch succeeds, and a failed re-fetch only surfaces while blocked. Dirty
// checks, patchers and payload shaping stay with each page.

import { useEffect, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";

/** What a config page's server component seeds its client with. */
export type ConfigSeed<C> = {
  initialConfig: C;
  initialUpdatedAt: string | null;
  loadError: string | null;
};

type Loaded<C> = ActionResult<{ config: C; updatedAt?: string | null }>;

export function useConfigEditor<C, R extends Loaded<C>>({
  initialConfig,
  initialUpdatedAt = null,
  loadError,
  load,
  onLoaded,
}: {
  initialConfig: C;
  initialUpdatedAt?: string | null;
  loadError: string | null;
  load: () => Promise<R>;
  onLoaded?: (r: Extract<R, { ok: true }>) => void;
}) {
  const [cfg, setCfg] = useState<C>(initialConfig);
  const [saved, setSaved] = useState<C>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [loadBlocked, setLoadBlocked] = useState(!!loadError);
  const [ok, setOk] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await load();
      if (!active) return;
      if (!r.ok) {
        if (loadBlocked) setError(r.error);
        return;
      }
      setCfg(r.config);
      setSaved(r.config);
      onLoaded?.(r as Extract<R, { ok: true }>);
      setUpdatedAt(r.updatedAt ?? null);
      setError(null);
      setLoadBlocked(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, []);

  const saveWith = (write: (cfg: C) => Promise<Loaded<C>>) => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await write(cfg);
      if (r.ok) {
        setSaved(r.config);
        setCfg(r.config);
        setUpdatedAt(r.updatedAt ?? null);
        setOk(true);
      } else {
        setError(r.error);
      }
    });
  };

  return { cfg, setCfg, saved, setOk, pending, error, loadBlocked, ok, updatedAt, saveWith };
}
