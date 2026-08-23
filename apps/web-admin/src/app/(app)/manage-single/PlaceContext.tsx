"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { updatePlace, type AdminPlace } from "./actions";
import {
  dirtyDialogNavBody,
  dirtyDialogReenrichBody,
  dirtyDialogTitle,
  dirtySectionLabels,
} from "./dirtySections";
import {
  INITIAL_HISTORY_GUARD,
  reduceHistoryGuard,
  type HistoryGuardState,
} from "./historyGuard";
import { ConfirmDialog } from "./ui";

/** Something that would throw away unsaved edits if it ran right now. */
type GuardedIntent = {
  /** Picks the confirm copy. */
  kind: "nav" | "reenrich" | "back";
  /** Runs only after the operator confirms the discard. */
  run: () => void;
};

/**
 * ONE SAVE, and it is genuinely atomic.
 *
 * The page used to carry eight SaveBars — four inside PlaceSection plus Menus,
 * Visits, Orders, Reservations and Enrichment — so "have I saved?" was eight
 * separate questions and the answer to each was an amber dot inside whichever
 * card you last touched. Pato, 2026-08-22: make it one.
 *
 * All-or-nothing was his call over per-box partial success, and the code makes
 * that honest rather than aspirational: PlaceSection, MenusSection, OrdersCard
 * and ReservationsCard all write through the SAME Edge Function
 * (`updatePlace` → business-web-update-project) with a patch keyed by `id`, and
 * their patch fragments touch disjoint columns. So the whole page's edits merge
 * into ONE object and go over ONE call — one row write, which either lands or
 * does not. There is no compensating-write fiction here and no window where
 * half the page is saved.
 *
 * A section registers what it would write and how to resync when it lands.
 * `getPatch` returns null when that section is clean, so a save only ever sends
 * columns somebody actually edited.
 *
 * NOT every box can join: VisitsCard writes the check PIN through
 * business-web-set-check-pin, a different EF, so it cannot ride the same row
 * write and keeps its own inline save. Folding it in would mean two sequential
 * calls, which is exactly the partial-failure state this model exists to avoid.
 */
export type PatchResult =
  /** Nothing edited here — contributes no columns. */
  | { kind: "clean" }
  /** These columns, please. */
  | { kind: "patch"; patch: Record<string, unknown> }
  /** The draft cannot be written yet, and this is why. */
  | { kind: "invalid"; error: string };

type SectionSaver = {
  /** What this section would write right now. */
  getPatch: () => PatchResult;
  /** Re-seed this section's local draft from the row the save returned. */
  onSaved: (fresh: AdminPlace) => void;
};

type PlaceContextValue = {
  projectId: string;
  place: AdminPlace;
  setPlace: (place: AdminPlace) => void;
  reload: () => void;
  /** Any registered section has unsaved drafts. */
  isDirty: boolean;
  setSectionDirty: (section: string, dirty: boolean) => void;
  /** Register a reset callback invoked when the operator discards dirty edits. */
  registerDiscardHandler: (section: string, handler: (() => void) | null) => void;
  requestDiscard: () => void;
  /** Join this section to the page-level save. Pass null to leave. */
  registerSaver: (section: string, saver: SectionSaver | null) => void;
  /** Human labels of every currently-dirty section, in UI order. */
  dirtyLabels: string[];
  /** A page-level save is in flight. */
  savePending: boolean;
  /** The last save's failure, or null. Cleared when a new save starts. */
  saveError: string | null;
  /** True briefly after a save lands, for the confirmation state. */
  saveOk: boolean;
  /** Merge every dirty section into one patch and write it in one call. */
  saveAll: () => void;
  /**
   * Intercept an action that would discard unsaved edits. Returns true when it
   * was intercepted (a confirm dialog is now open) and false when the caller
   * should just proceed.
   *
   * Lives on the context, not in PlaceEditChrome, so every exit path can reach
   * it — including CrossTabLink and completeness chips.
   */
  guardIntent: (intent: GuardedIntent) => boolean;
  /** guardIntent for the common case: following a link. */
  guardNav: (href: string, e?: { preventDefault: () => void }) => boolean;
};

const PlaceContext = createContext<PlaceContextValue | null>(null);

const HISTORY_MARKER = { __mesitaPlaceDirty: true as const };

function pushSentinel() {
  window.history.pushState(HISTORY_MARKER, "", window.location.href);
}

export function PlaceProvider({
  projectId,
  place,
  setPlace,
  reload,
  children,
}: {
  projectId: string;
  place: AdminPlace;
  setPlace: (place: AdminPlace) => void;
  reload: () => void;
  children: ReactNode;
}) {
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});
  const discardHandlers = useRef<Record<string, () => void>>({});
  const savers = useRef<Record<string, SectionSaver>>({});
  const historyRef = useRef<HistoryGuardState>(INITIAL_HISTORY_GUARD);
  const isDirtyRef = useRef(false);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const setSectionDirty = useCallback((section: string, dirty: boolean) => {
    setDirtyMap((prev) => {
      if (Boolean(prev[section]) === dirty) return prev;
      if (!dirty) {
        const next = { ...prev };
        delete next[section];
        return next;
      }
      return { ...prev, [section]: true };
    });
  }, []);

  const registerDiscardHandler = useCallback(
    (section: string, handler: (() => void) | null) => {
      if (!handler) {
        delete discardHandlers.current[section];
        return;
      }
      discardHandlers.current[section] = handler;
    },
    [],
  );

  const registerSaver = useCallback(
    (section: string, saver: SectionSaver | null) => {
      if (!saver) {
        delete savers.current[section];
        return;
      }
      savers.current[section] = saver;
    },
    [],
  );

  const requestDiscard = useCallback(() => {
    for (const handler of Object.values(discardHandlers.current)) {
      handler();
    }
    setDirtyMap({});
    setSaveError(null);
  }, []);

  // ONE call for the whole page. Object.assign is safe here precisely because
  // the fragments are disjoint — each box owns its own columns — so no section
  // can silently clobber another's edit on the way into the patch.
  const saveAll = useCallback(() => {
    const results = Object.values(savers.current).map((s) => s.getPatch());

    // One invalid draft blocks the whole save. That follows from all-or-
    // nothing rather than fighting it: if a box cannot be written, writing the
    // others would be a partial save wearing a success message.
    const invalid = results.find((r) => r.kind === "invalid");
    if (invalid && invalid.kind === "invalid") {
      setSaveOk(false);
      setSaveError(invalid.error);
      return;
    }

    const fragments = results.flatMap((r) => (r.kind === "patch" ? [r.patch] : []));
    if (fragments.length === 0) return;

    setSaveError(null);
    setSaveOk(false);
    setSavePending(true);
    void (async () => {
      const patch = Object.assign({ id: projectId }, ...fragments) as {
        id: string;
      } & Record<string, unknown>;
      const r = await updatePlace(patch);
      setSavePending(false);
      if (!r.ok) {
        // Nothing was written, so nothing is re-seeded and every draft stays
        // exactly as the operator left it — the whole point of one call.
        setSaveError(r.error);
        return;
      }
      for (const s of Object.values(savers.current)) s.onSaved(r.data);
      setPlace(r.data);
      setDirtyMap({});
      setSaveOk(true);
      window.setTimeout(() => setSaveOk(false), 2500);
    })();
  }, [projectId, setPlace]);

  const isDirty = useMemo(
    () => Object.values(dirtyMap).some(Boolean),
    [dirtyMap],
  );

  const dirtyLabels = useMemo(
    () => dirtySectionLabels(dirtyMap),
    [dirtyMap],
  );

  const router = useRouter();
  const [pending, setPending] = useState<GuardedIntent | null>(null);

  const applyHistory = useCallback((event: Parameters<typeof reduceHistoryGuard>[1]) => {
    const { state, effects } = reduceHistoryGuard(historyRef.current, event);
    historyRef.current = state;
    for (const effect of effects) {
      if (effect === "push-sentinel" || effect === "reassert") {
        pushSentinel();
      } else if (effect === "back") {
        window.history.back();
      }
    }
    return state;
  }, []);

  // Sync history trap to dirty flips (pushState is an external system).
  useEffect(() => {
    isDirtyRef.current = isDirty;
    if (isDirty) applyHistory({ type: "dirty-on" });
    else applyHistory({ type: "dirty-off" });
  }, [isDirty, applyHistory]);

  useEffect(() => {
    const onPopState = () => {
      // Prefer the ref so a just-unmounted section's cleanup hasn't raced us
      // into thinking we're clean before the trap can reassert.
      if (!isDirtyRef.current && !historyRef.current.trapping) return;
      const next = applyHistory({ type: "popstate" });
      if (next.dialogOpen) {
        // Stay on this URL (already reasserted). Confirm only discards drafts —
        // navigating away via history.back() races App Router unmount cleanup.
        setPending({
          kind: "back",
          run: () => {
            applyHistory({ type: "cancel-leave" });
          },
        });
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyHistory]);

  const guardIntent = useCallback(
    (intent: GuardedIntent) => {
      if (!isDirty) return false;
      setPending(intent);
      return true;
    },
    [isDirty],
  );

  const guardNav = useCallback(
    (href: string, e?: { preventDefault: () => void }) => {
      if (!isDirty) return false;
      e?.preventDefault();
      setPending({ kind: "nav", run: () => router.push(href) });
      return true;
    },
    [isDirty, router],
  );

  const confirmDiscard = useCallback(() => {
    if (!pending) return;
    const intent = pending;
    setPending(null);
    requestDiscard();
    intent.run();
  }, [pending, requestDiscard]);

  const cancelPending = useCallback(() => {
    if (pending?.kind === "back") {
      applyHistory({ type: "cancel-leave" });
    }
    setPending(null);
  }, [pending, applyHistory]);

  const value = useMemo(
    () => ({
      projectId,
      place,
      setPlace,
      reload,
      isDirty,
      setSectionDirty,
      registerDiscardHandler,
      requestDiscard,
      registerSaver,
      dirtyLabels,
      savePending,
      saveError,
      saveOk,
      saveAll,
      guardIntent,
      guardNav,
    }),
    [
      projectId,
      place,
      setPlace,
      reload,
      isDirty,
      setSectionDirty,
      registerDiscardHandler,
      requestDiscard,
      registerSaver,
      dirtyLabels,
      savePending,
      saveError,
      saveOk,
      saveAll,
      guardIntent,
      guardNav,
    ],
  );

  const title = dirtyDialogTitle(dirtyLabels);
  const bodyText =
    pending?.kind === "reenrich"
      ? dirtyDialogReenrichBody(dirtyLabels)
      : dirtyDialogNavBody(dirtyLabels);

  return (
    <PlaceContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={pending != null}
        title={title}
        body={<p>{bodyText}</p>}
        confirmLabel={
          pending?.kind === "reenrich"
            ? "Discard & re-enrich"
            : pending?.kind === "back"
              ? "Discard changes"
              : "Discard & leave"
        }
        danger
        onConfirm={confirmDiscard}
        onCancel={cancelPending}
      />
    </PlaceContext.Provider>
  );
}

export function usePlaceContext() {
  const ctx = useContext(PlaceContext);
  if (!ctx) {
    throw new Error("usePlaceContext must be used within PlaceProvider");
  }
  return ctx;
}
