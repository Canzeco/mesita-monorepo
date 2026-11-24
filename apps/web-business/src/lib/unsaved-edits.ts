// Which screens hold unsaved drafts, for code outside their provider
// (MESITA-3181): DeploymentWatcher sits in the root layout and must never
// reload over them. One key per writer (MESITA-4900): the profile form stays
// mounted under Offers, so leaving Offers must not clear the profile's mark.
const unsaved = new Set<string>();

export function setUnsavedEdits(key: string, dirty: boolean): void {
  if (dirty) unsaved.add(key);
  else unsaved.delete(key);
}

export function hasUnsavedEdits(): boolean {
  return unsaved.size > 0;
}

/** Closing or reloading the tab asks first; returns the cleanup. */
export function guardUnsavedEdits(key: string): () => void {
  setUnsavedEdits(key, true);
  const ask = (e: BeforeUnloadEvent) => e.preventDefault();
  window.addEventListener("beforeunload", ask);
  return () => {
    window.removeEventListener("beforeunload", ask);
    setUnsavedEdits(key, false);
  };
}
