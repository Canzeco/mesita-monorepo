"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import { getPromosConfig, updatePromosConfig } from "./actions";
import {
  DEFAULT_PROMOS,
  additivityError,
  deriveOrders,
  deriveVisits,
  expandOrders,
  expandVisits,
  type BonusKey,
  type OrdersComponents,
  type PromosConfig,
  type StrategyKey,
  type VisitsComponents,
} from "./promos";

// ONE document. Visit knobs, the Soon field, and the distribution simulator
// share this state. The dirty flag, Save, and load error live HERE.
//
// The alternative — a Save button per subpage, each sending the whole blob —
// would let a Save on Visits revert unsaved Orders edits, with a success
// toast. That is exactly the stale-tab clobber MESITA-1098 closed, reintroduced
// between two tabs of one page.
//
// The page edits COMPONENTS; storage keeps the GRID (D12, no version bump).
// Components are derived once when config arrives and expanded back on save;
// `additivityError` gates Save so an inverted ladder is caught inline rather
// than as a 400 after the click.

type PromosStateValue = {
  cfg: PromosConfig;
  visits: VisitsComponents;
  orders: OrdersComponents;
  setVisits: (next: VisitsComponents) => void;
  setOrders: (next: OrdersComponents) => void;
  setBonus: (
    context: "visits" | "orders",
    strategy: StrategyKey,
    key: BonusKey,
    value: number,
  ) => void;
  setCap: (value: number) => void;
  resetDefaults: () => void;
  save: () => void;
  dirty: boolean;
  pending: boolean;
  ok: boolean;
  error: string | null;
  loadBlocked: boolean;
  seeded: boolean;
  updatedAt: string | null;
  /** Non-null when the current components cannot be stored — blocks Save. */
  ladderError: string | null;
};

const Ctx = createContext<PromosStateValue | null>(null);

export function usePromosState(): PromosStateValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePromosState must be used inside PromosState");
  return v;
}

export function PromosState({
  initialConfig,
  initialUpdatedAt,
  initialSeeded,
  loadError,
  children,
}: {
  initialConfig: PromosConfig;
  initialUpdatedAt: string | null;
  initialSeeded: boolean;
  loadError: string | null;
  children: React.ReactNode;
}) {
  const [cfg, setCfg] = useState<PromosConfig>(initialConfig);
  const [saved, setSaved] = useState<PromosConfig>(initialConfig);
  const [visits, setVisitsState] = useState<VisitsComponents>(() =>
    deriveVisits(initialConfig.visits.base),
  );
  const [orders, setOrdersState] = useState<OrdersComponents>(() =>
    deriveOrders(initialConfig.orders.base),
  );
  const [seeded, setSeeded] = useState(initialSeeded);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [loadBlocked, setLoadBlocked] = useState(!!loadError);
  const [ok, setOk] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  const adopt = (next: PromosConfig) => {
    setCfg(next);
    setVisitsState(deriveVisits(next.visits.base));
    setOrdersState(deriveOrders(next.orders.base));
  };

  // Re-fetch on mount so a client-side nav shows the live blob, not a stale
  // server render. Success clears a failed-load Save block (MESITA-737).
  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getPromosConfig();
      if (!active) return;
      if (!r.ok) {
        if (loadBlocked) setError(r.error);
        return;
      }
      adopt(r.config);
      setSaved(r.config);
      setSeeded(r.seeded);
      setUpdatedAt(r.updatedAt);
      setError(null);
      setLoadBlocked(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, []);

  // The wire shape: components expanded back into the stored grid.
  const wire = useMemo<PromosConfig>(
    () => ({
      ...cfg,
      visits: { ...cfg.visits, base: expandVisits(visits) },
      orders: { ...cfg.orders, base: expandOrders(orders) },
    }),
    [cfg, visits, orders],
  );

  const dirty = useMemo(
    () => JSON.stringify(wire) !== JSON.stringify(saved),
    [wire, saved],
  );
  const ladderError = useMemo(
    () => additivityError(wire.visits.base),
    [wire.visits.base],
  );

  const value: PromosStateValue = {
    cfg: wire,
    visits,
    orders,
    setVisits: (next) => {
      setVisitsState(next);
      setOk(false);
    },
    setOrders: (next) => {
      setOrdersState(next);
      setOk(false);
    },
    setBonus: (context, strategy, key, v) => {
      setCfg((c) => ({
        ...c,
        [context]: {
          ...c[context],
          bonuses: {
            ...c[context].bonuses,
            [strategy]: { ...c[context].bonuses[strategy], [key]: v },
          },
        },
      }));
      setOk(false);
    },
    setCap: (v) => {
      setCfg((c) => ({ ...c, cap: v }));
      setOk(false);
    },
    resetDefaults: () => {
      adopt(structuredClone(DEFAULT_PROMOS));
      setOk(false);
    },
    save: () => {
      if (loadBlocked || ladderError) return;
      setError(null);
      startTransition(async () => {
        const r = await updatePromosConfig(wire);
        if (r.ok) {
          setSaved(r.config);
          adopt(r.config);
          setSeeded(false);
          setUpdatedAt(r.updatedAt);
          setOk(true);
        } else {
          setError(r.error);
        }
      });
    },
    dirty,
    pending,
    ok,
    error,
    loadBlocked,
    seeded,
    updatedAt,
    ladderError,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
