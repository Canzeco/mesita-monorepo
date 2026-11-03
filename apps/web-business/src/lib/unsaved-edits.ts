// Whether the place editor holds unsaved drafts, for code outside its provider
// (MESITA-3181): DeploymentWatcher sits in the root layout and must never
// reload over them. PlaceContext writes it; live saves are data.
let unsaved = false;

export function setUnsavedEdits(next: boolean): void {
  unsaved = next;
}

export function hasUnsavedEdits(): boolean {
  return unsaved;
}
