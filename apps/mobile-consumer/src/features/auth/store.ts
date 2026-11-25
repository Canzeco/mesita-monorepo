import { useSyncExternalStore } from "react";

import { SIGNED_OUT, type Session } from "./model";

let session: Session = SIGNED_OUT;
const listeners = new Set<() => void>();

export const getSession = () => session;

export function setSession(patch: Partial<Session>): void {
  session = { ...session, ...patch };
  listeners.forEach((listen) => listen());
}

function subscribe(listen: () => void) {
  listeners.add(listen);
  return () => void listeners.delete(listen);
}

export function useSession(): Session {
  return useSyncExternalStore(subscribe, getSession, getSession);
}
