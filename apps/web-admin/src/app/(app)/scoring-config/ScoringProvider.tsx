"use client";

import { createContext, useContext, useMemo, useState, useTransition } from "react";
import {
  coerceScoringSettings,
  DECK_COUNT_MAX,
  DEFAULT_SCORING_SETTINGS,
  type ContextConfig,
  type DeckKey,
  type Decks,
  type EngineId,
  type EsParams,
  type GpParams,
  type ScoringSettings,
  type IcParams,
} from "@/lib/business/scores";
import { type StrategyId } from "@/lib/business/strategies";
import type { SampleConsumer, SamplePlace } from "@/lib/business/cip";
import { updateScoringSettings } from "./settings-actions";

// Shared state for the Scoring Config tabs. The layout mounts this ONCE, so
// knobs set on Subscores carry into the Cards and Decks tabs live and survive
// tab switches — the Decks tab's max steppers ARE the same form state. The DB sample flows through as plain props; the
// SAVED settings blob seeds the knobs on first mount (null in DB = code
// defaults).
//
// Save = whole-blob write to app_settings.scoring_config via the EF pair.
// Reset-to-defaults = load DEFAULT_SCORING_SETTINGS into the form (dirty
// until saved). Cancel = revert the form to the last-saved values.

type Retrieval = ScoringSettings["retrieval"];
type RpVals = Record<StrategyId, number>;

function fromSettings(s: ScoringSettings): {
  decks: Decks;
  retrieval: Retrieval;
  esParams: EsParams;
  gpParams: GpParams;
  rpVals: RpVals;
  cfg: IcParams;
  context: ContextConfig;
} {
  return {
    decks: {
      swipe: { ...s.decks.swipe },
      map: { ...s.decks.map },
      memo: { ...s.decks.memo },
    },
    retrieval: s.retrieval,
    esParams: { ...s.es },
    gpParams: { ...s.gp },
    rpVals: { ...s.rp },
    cfg: { ...s.ic },
    context: { es: [...s.context.es] },
  };
}

type ScoringCtx = {
  consumers: SampleConsumer[];
  places: SamplePlace[];
  /** Deck composition — cards per lane per engine. Shared with the Deck Sim. */
  decks: Decks;
  /** The one mutation path for deck counts (rounds + clamps 0–DECK_COUNT_MAX). */
  setDeckCount: (engine: EngineId, key: DeckKey, n: number) => void;
  retrieval: Retrieval;
  setRetrieval: React.Dispatch<React.SetStateAction<Retrieval>>;
  /** ES internals — the encoder's params. */
  esParams: EsParams;
  setEsParams: React.Dispatch<React.SetStateAction<EsParams>>;
  /** GP internals — the popularity curve's params. */
  gpParams: GpParams;
  setGpParams: React.Dispatch<React.SetStateAction<GpParams>>;
  /** RP — the rung each posture earns. */
  rpVals: RpVals;
  setRpVals: React.Dispatch<React.SetStateAction<RpVals>>;
  /** IC's knobs. */
  cfg: IcParams;
  setCfg: React.Dispatch<React.SetStateAction<IcParams>>;
  /** Which fields ES reads — the configurable pipeline. */
  context: ContextConfig;
  /** Toggle one registry field in ES's context. */
  toggleContext: (key: string) => void;
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  savedOk: boolean;
  save: () => void;
  /** Load code defaults into the form (dirty until saved). */
  resetToDefaults: () => void;
  /** Revert the form to the last-saved values. */
  revert: () => void;
};

const Ctx = createContext<ScoringCtx | null>(null);

export function ScoringProvider({
  consumers,
  places,
  initialConfig,
  children,
}: {
  consumers: SampleConsumer[];
  places: SamplePlace[];
  /** Raw app_settings.scoring_config (null = code defaults). */
  initialConfig: unknown;
  children: React.ReactNode;
}) {
  // Seed once from the saved blob; the provider persists across tab
  // navigation and router.refresh, so knobs never reset behind the operator.
  const [saved, setSaved] = useState<ScoringSettings>(() =>
    coerceScoringSettings(initialConfig),
  );
  const seed = useMemo(() => fromSettings(saved), [saved]);
  const [decks, setDecks] = useState<Decks>(seed.decks);
  const [retrieval, setRetrieval] = useState<Retrieval>(seed.retrieval);
  const [esParams, setEsParams] = useState<EsParams>(seed.esParams);
  const [gpParams, setGpParams] = useState<GpParams>(seed.gpParams);
  const [rpVals, setRpVals] = useState<RpVals>(seed.rpVals);
  const [cfg, setCfg] = useState<IcParams>(seed.cfg);
  const [context, setContext] = useState<ContextConfig>(seed.context);

  const setDeckCount = (engine: EngineId, key: DeckKey, n: number) =>
    setDecks((d) => ({
      ...d,
      [engine]: {
        ...d[engine],
        [key]: Math.max(0, Math.min(DECK_COUNT_MAX, Math.round(Number.isFinite(n) ? n : 0))),
      },
    }));

  const toggleContext = (key: string) =>
    setContext((c) => ({
      es: c.es.includes(key) ? c.es.filter((k) => k !== key) : [...c.es, key],
    }));

  const [saving, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  // Literal-constructed in the SAME key order coerceScoringSettings outputs —
  // the dirty diff is JSON.stringify equality.
  const current: ScoringSettings = useMemo(
    () => ({
      v: 3,
      decks: {
        swipe: { on: decks.swipe.on, of: decks.swipe.of, in: decks.swipe.in, if: decks.swipe.if },
        map: { on: decks.map.on, of: decks.map.of, in: decks.map.in, if: decks.map.if },
        memo: { on: decks.memo.on, of: decks.memo.of, in: decks.memo.in, if: decks.memo.if },
      },
      retrieval: { recallTopK: retrieval.recallTopK },
      es: { ...esParams },
      gp: { ...gpParams },
      rp: {
        zero: rpVals.zero,
        conservative: rpVals.conservative,
        aggressive: rpVals.aggressive,
        dominant: rpVals.dominant,
      },
      ic: { ...cfg },
      // Sorted so toggle order never fakes a diff against the saved blob.
      context: { es: [...context.es].sort() },
    }),
    [decks, retrieval, esParams, gpParams, rpVals, cfg, context],
  );

  const dirty = useMemo(
    () => JSON.stringify(current) !== JSON.stringify(saved),
    [current, saved],
  );

  const apply = (s: ScoringSettings) => {
    const f = fromSettings(s);
    setDecks(f.decks);
    setRetrieval(f.retrieval);
    setEsParams(f.esParams);
    setGpParams(f.gpParams);
    setRpVals(f.rpVals);
    setCfg(f.cfg);
    setContext(f.context);
  };

  const save = () => {
    setSaveError(null);
    setSavedOk(false);
    startSave(async () => {
      const r = await updateScoringSettings(current);
      if (!r.ok) {
        setSaveError(r.error);
        return;
      }
      const clean = coerceScoringSettings(r.config);
      setSaved(clean);
      apply(clean);
      setSavedOk(true);
      window.setTimeout(() => setSavedOk(false), 2500);
    });
  };

  return (
    <Ctx.Provider
      value={{
        consumers,
        places,
        decks,
        setDeckCount,
        retrieval,
        setRetrieval,
        esParams,
        setEsParams,
        gpParams,
        setGpParams,
        rpVals,
        setRpVals,
        cfg,
        setCfg,
        context,
        toggleContext,
        dirty,
        saving,
        saveError,
        savedOk,
        save,
        resetToDefaults: () => apply(DEFAULT_SCORING_SETTINGS),
        revert: () => apply(saved),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useScoring(): ScoringCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useScoring must be used inside ScoringProvider");
  return ctx;
}
