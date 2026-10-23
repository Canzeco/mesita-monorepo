"use client";

// The operator's current-location radius as a React value (MESITA-2703);
// the store is `operator-radius.ts`.

import { useSyncExternalStore } from "react";
import {
  getOperatorRadiusKm,
  OPERATOR_RADIUS_KM_DEFAULT,
  subscribeOperatorRadiusKm,
} from "@/lib/operator-radius";

export function useOperatorRadiusKm(): number {
  return useSyncExternalStore(subscribeOperatorRadiusKm, getOperatorRadiusKm, () => OPERATOR_RADIUS_KM_DEFAULT);
}
