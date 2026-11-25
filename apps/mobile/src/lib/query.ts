import { dehydrate, focusManager, hydrate, onlineManager, QueryClient, type DehydratedState } from "@tanstack/react-query";
import * as Network from "expo-network";
import { AppState } from "react-native";

import { dataVersion } from "@/lib/build";
import { EdgeError } from "@/lib/edge";
import { secret } from "@/lib/storage";

const DAY = 24 * 60 * 60 * 1000;

declare module "@tanstack/react-query" {
  interface Register {
    /** persist: kept on the device for this guest, at most a day. The
     *  allowlist: my profile, the wallet, my reservations. */
    queryMeta: { persist?: boolean };
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: DAY,
      staleTime: 30_000,
      retry: (count, err) => count < 2 && (!(err instanceof EdgeError) || err.retry === "safe"),
    },
    // Sent now or failed now: never paused, never retried, never saved.
    mutations: { retry: false, networkMode: "always" },
  },
});

export function followDevice(): () => void {
  focusManager.setFocused(AppState.currentState === "active");
  const app = AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));
  const net = Network.addNetworkStateListener((state) => onlineManager.setOnline(state.isConnected !== false));
  return () => {
    app.remove();
    net.remove();
  };
}

// ── The persisted reads ─────────────────────────────────────────────
// Per guest, encrypted, dropped on another update or contract number.

const nameFor = (guestId: string) => `mesita.reads.${guestId}`;

type Saved = { version: string; at: number; state: DehydratedState };

let keeping: { guestId: string; stop: () => void } | null = null;
let writes: Promise<unknown> = Promise.resolve();
const inOrder = (work: () => Promise<unknown>) => (writes = writes.then(work, work).catch(() => undefined));

/** Load this guest's saved reads and keep saving them. */
export async function keepReads(guestId: string): Promise<void> {
  if (keeping?.guestId === guestId) return;
  keeping?.stop();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "success" || !event.query.meta?.persist) return;
    clearTimeout(timer);
    timer = setTimeout(() => void saveReads(guestId), 500);
  });
  const mine = {
    guestId,
    stop: () => {
      clearTimeout(timer);
      unsubscribe();
    },
  };
  keeping = mine;

  const raw = await secret.get(nameFor(guestId));
  if (!raw || keeping !== mine) return;
  try {
    const saved = JSON.parse(raw) as Saved;
    if (saved.version === dataVersion && Date.now() - saved.at < DAY) hydrate(queryClient, saved.state);
    else await secret.remove(nameFor(guestId));
  } catch {
    await secret.remove(nameFor(guestId));
  }
}

export function saveReads(guestId: string): Promise<unknown> {
  return inOrder(async () => {
    if (keeping?.guestId !== guestId) return;
    const state = dehydrate(queryClient, {
      shouldDehydrateQuery: (q) => q.meta?.persist === true && q.state.status === "success",
      shouldDehydrateMutation: () => false,
    });
    // The age is the oldest read's, so saving one again never renews another.
    const at = Math.min(Date.now(), ...state.queries.map((q) => q.state.dataUpdatedAt));
    await secret.set(nameFor(guestId), JSON.stringify({ version: dataVersion, at, state } satisfies Saved));
  });
}

/** The guest is gone: nothing of theirs stays, in memory or on the device. */
export async function forgetReads(guestId: string | null): Promise<void> {
  keeping?.stop();
  keeping = null;
  await queryClient.cancelQueries();
  queryClient.clear();
  if (guestId) await inOrder(() => secret.remove(nameFor(guestId)));
}
