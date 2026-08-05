"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { AdminPlace } from "./actions";
import { ConfirmDialog } from "./ui";

/** Something that would throw away unsaved edits if it ran right now. */
type GuardedIntent = {
  /** Picks the confirm copy. */
  kind: "nav" | "reenrich";
  /** Runs only after the operator confirms the discard. */
  run: () => void;
};

type UnitPlaceContextValue = {
  projectId: string;
  place: AdminPlace;
  setPlace: (place: AdminPlace) => void;
  reload: () => void;
  /** Any Place/Products box has unsaved edits. */
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
   * Lives on the context, not in UnitEditChrome, because the guard has to reach
   * every exit path — including the cross-tab links rendered deep inside
   * PlaceSection (PromosCard, VerificationCard and the read-only stubs). While it
   * was a local useCallback in the chrome, those links navigated straight past
   * it and silently dropped the operator's edits.
   */
  guardIntent: (intent: GuardedIntent) => boolean;
  /** guardIntent for the common case: following a link. */
  guardNav: (href: string, e?: { preventDefault: () => void }) => boolean;
};

const UnitPlaceContext = createContext<UnitPlaceContextValue | null>(null);

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

  const router = useRouter();
  const [pending, setPending] = useState<GuardedIntent | null>(null);

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

  return (
    <UnitPlaceContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={pending != null}
        title="Unsaved Place edits"
        body={
          pending?.kind === "reenrich" ? (
            <p>
              Re-enrich can overwrite fields you&apos;re editing. Discard unsaved
              changes and queue the Enricher, or cancel and save first.
            </p>
          ) : (
            <p>
              You have unsaved Place edits. Discard them to leave this page, or
              cancel and save first.
            </p>
          )
        }
        confirmLabel={
          pending?.kind === "reenrich" ? "Discard & re-enrich" : "Discard & leave"
        }
        danger
        onConfirm={confirmDiscard}
        onCancel={() => setPending(null)}
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
