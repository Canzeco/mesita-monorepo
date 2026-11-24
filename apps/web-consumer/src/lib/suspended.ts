// A SUSPENDED ACCOUNT (MESITA-4899): any call answered `suspended` puts the one
// screen up. A plain store, so invokeEF can say it without React.

let suspended = false;
const listeners = new Set<() => void>();

export function noteSuspended(): void {
  if (suspended) return;
  suspended = true;
  listeners.forEach((l) => l());
}
export const readSuspended = () => suspended;
export function onSuspended(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
