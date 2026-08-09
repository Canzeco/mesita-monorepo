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
import type { AdminPlace } from "./actions";
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

type UnitPlaceContextValue = {
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
  /**
   * Intercept an action that would discard unsaved edits. Returns true when it
   * was intercepted (a confirm dialog is now open) and false when the caller
   * should just proceed.
   *
   * Lives on the context, not in UnitEditChrome, so every exit path can reach
   * it — including CrossTabLink and completeness chips.
   */
  guardIntent: (intent: GuardedIntent) => boolean;
  /** guardIntent for the common case: following a link. */
  guardNav: (href: string, e?: { preventDefault: () => void }) => boolean;
};

const UnitPlaceContext = createContext<UnitPlaceContextValue | null>(null);

const HISTORY_MARKER = { __mesitaUnitDirty: true as const };

function pushSentinel() {
  window.history.pushState(HISTORY_MARKER, "", window.location.href);
}

export function UnitPlaceProvider({
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
  const historyRef = useRef<HistoryGuardState>(INITIAL_HISTORY_GUARD);
  const [, bumpHistory] = useState(0);

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

  const requestDiscard = useCallback(() => {
    for (const handler of Object.values(discardHandlers.current)) {
      handler();
    }
    setDirtyMap({});
  }, []);

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
    bumpHistory((n) => n + 1);
    return state;
  }, []);

  // History trap while any section is dirty (E-R3).
  useEffect(() => {
    if (isDirty) {
      applyHistory({ type: "dirty-on" });
    } else {
      applyHistory({ type: "dirty-off" });
    }
  }, [isDirty, applyHistory]);

  useEffect(() => {
    const onPopState = () => {
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
    <UnitPlaceContext.Provider value={value}>
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
    </UnitPlaceContext.Provider>
  );
}

export function useUnitPlace() {
  const ctx = useContext(UnitPlaceContext);
  if (!ctx) {
    throw new Error("useUnitPlace must be used within UnitPlaceProvider");
  }
  return ctx;
}
