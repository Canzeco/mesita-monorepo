"use client";

// THE PAGE'S ONE SAVE, and the only piece of the real Profile that could not
// be snapshotted.
//
// `apps/web-business/src/components/place-manage/PlaceContext.tsx` is ~390
// lines: an optimistic `AdminPlace` in flight, a `business-web-update-place`
// round trip, a per-section dirty registry, a router guard that intercepts
// cross-tab navigation while a form is dirty, and a discard dialog. All of it
// is machinery around ONE network call this app does not make.
//
// What survives is the SHAPE the screen reads — `isDirty`, `dirtyLabels`,
// `savePending`, `saveOk`, `saveError`, `saveAll`, `requestDiscard` — so
// `PlaceSection` and `PlaceSaveBar` below are the real files with their
// imports repointed, rather than rewrites.
//
// AND THE SAVE ACTUALLY SAVES. It writes the profile into the store, which is
// what re-derives the heading's name, the rail's photo and the completeness
// meter. The alternative — a Save that flips a pill and changes nothing — is
// the one lie a harness must not tell, because it is the exact bug a reviewer
// would be here to catch.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useMock } from "@/mock/MockStore";
import type { MockPlaceProfile } from "@/mock/types";

/** A save is INSTANT here — there is no network — so the spinner would never
 *  appear and the one state an operator sees most while saving would be the
 *  one state this app could not show. Half a second is long enough to read
 *  "Saving…" and short enough not to feel broken. */
const FAKE_LATENCY_MS = 550;

/** What a section hands back when the bar is pressed. Three outcomes, not two:
 *  `invalid` is what lets the Photos box refuse an over-ceiling gallery with a
 *  sentence instead of silently truncating it. */
export type SaveBuild =
  | { kind: "patch"; profile: MockPlaceProfile }
  | { kind: "invalid"; error: string }
  | { kind: "clean" };

type Section = {
  label: string;
  dirty: boolean;
  build: () => SaveBuild;
  onSaved: (fresh: MockPlaceProfile) => void;
  onReset: () => void;
};

type PlaceContextValue = {
  placeId: string;
  /** The place's profile as the world currently holds it. */
  profile: MockPlaceProfile;
  isDirty: boolean;
  /** Which boxes are unsaved, by name — the bar prints them rather than
   *  asserting that "something" is. */
  dirtyLabels: string[];
  savePending: boolean;
  saveOk: boolean;
  saveError: string | null;
  saveAll: () => void;
  requestDiscard: () => void;
  register: (section: Section | null) => void;
};

const Ctx = createContext<PlaceContextValue | null>(null);

export function usePlaceContext(): PlaceContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlaceContext must be used under PlaceFormProvider");
  return v;
}

/** The update EF's own 403, word for word (`requireEditor`'s default in
 *  supabase/functions/_shared/auth-membership.ts). A VIEWER'S FORM IS NOT
 *  DISABLED in the real console — nothing in `PlaceSection` reads the role, so
 *  a viewer can type into every field and press Save, and the server is what
 *  says no. That refusal has never been seen by anyone who is not a viewer on
 *  a real place, which makes it exactly the kind of state this app is for. */
const VIEWER_REFUSAL = "Editors and owners only.";

export function PlaceFormProvider({
  placeId,
  profile,
  readOnly = false,
  children,
}: {
  placeId: string;
  profile: MockPlaceProfile;
  /** The caller is a viewer here. The form still edits; the save still fails. */
  readOnly?: boolean;
  children: React.ReactNode;
}) {
  const { saveProfile } = useMock();
  // A REF, not state: the section re-registers on every render (its `build`
  // closes over the live form), and storing that in state would set state
  // during render for no reader — nothing paints the callbacks, only the
  // booleans beside them.
  const sectionRef = useRef<Section | null>(null);
  const [dirty, setDirty] = useState(false);
  const [dirtyLabels, setDirtyLabels] = useState<string[]>([]);
  const [savePending, setSavePending] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const register = useCallback((section: Section | null) => {
    sectionRef.current = section;
    // The booleans DO paint, so they are state — set from the section's own
    // effect, never from this render.
    setDirty(section?.dirty ?? false);
    setDirtyLabels(section?.dirty ? [section.label] : []);
  }, []);

  const saveAll = useCallback(() => {
    const section = sectionRef.current;
    if (!section || savePending) return;
    const built = section.build();
    if (built.kind === "invalid") {
      setSaveError(built.error);
      setSaveOk(false);
      return;
    }
    if (built.kind === "clean") return;
    setSaveError(null);
    setSavePending(true);
    const next = built.profile;
    window.setTimeout(() => {
      setSavePending(false);
      // The refusal lands where a real one would: AFTER the round trip, with
      // the form still dirty and the typed text still in it.
      if (readOnly) {
        setSaveError(VIEWER_REFUSAL);
        setSaveOk(false);
        return;
      }
      saveProfile(placeId, next);
      sectionRef.current?.onSaved(next);
      setSaveOk(true);
    }, FAKE_LATENCY_MS);
  }, [placeId, readOnly, saveProfile, savePending]);

  const requestDiscard = useCallback(() => {
    // NO CONFIRM DIALOG. The real one asks because a discard there throws away
    // work typed against a live record; here the record is a fixture and the
    // worst case is retyping a sentence into a mock.
    sectionRef.current?.onReset();
    setSaveError(null);
    setSaveOk(false);
  }, []);

  return (
    <Ctx.Provider
      value={{
        placeId,
        profile,
        isDirty: dirty,
        dirtyLabels,
        savePending,
        saveOk,
        saveError,
        saveAll,
        requestDiscard,
        register,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

/** The hook `PlaceSection` calls — same name and same five arguments as the
 *  real `useSectionDirty`'s `useSectionSaver`, so the file that calls it did
 *  not have to change.
 *
 *  The callbacks go through a REF rather than the dependency list: `build`
 *  closes over the live form and so is a new function on every keystroke, and
 *  a dependency on it would re-register (and therefore set state) on every one
 *  of them. What the provider actually paints is the dirty flag and the label,
 *  so those are what the effect watches. */
export function useSectionSaver(
  label: string,
  dirty: boolean,
  build: () => SaveBuild,
  onSaved: (fresh: MockPlaceProfile) => void,
  onReset: () => void,
): void {
  const { register } = usePlaceContext();
  const latest = useRef<Section>({ label, dirty, build, onSaved, onReset });

  // The refresh is an EFFECT, not a write during render: `react-hooks/refs`
  // refuses the latter, and it is right to — a ref written while rendering is
  // a value React cannot see change. No dependency array, so it runs after
  // every render, which is before any click that could read it.
  useEffect(() => {
    latest.current = { label, dirty, build, onSaved, onReset };
  });

  useEffect(() => {
    register({
      label,
      dirty,
      build: () => latest.current.build(),
      onSaved: (fresh) => latest.current.onSaved(fresh),
      onReset: () => latest.current.onReset(),
    });
    return () => register(null);
  }, [register, dirty, label]);
}
