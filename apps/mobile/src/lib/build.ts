import Constants from "expo-constants";
import * as Updates from "expo-updates";

/** The contract number this JavaScript was written for (Docs › Apps › A2 §8).
 *  Raise it when a backend answer it needs changes shape. */
export const CONTRACT = 1;

export const variant: string = Constants.expoConfig?.extra?.variant ?? "production";

/** Names the JavaScript running: a published update, or the binary's own. */
export const updateId = Updates.updateId ?? `embedded-${Constants.expoConfig?.version ?? "0"}`;

/** Persisted reads are dropped when this changes. */
export const dataVersion = `${CONTRACT}:${updateId}`;
