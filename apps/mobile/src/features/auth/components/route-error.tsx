import { useSegments, type ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";

import { ErrorState } from "@/components/error-state";
import { report, routePattern } from "@/lib/report";

/** A crash in one screen: its own error state, reported, never the app's end. */
export function RouteError({ error, retry }: ErrorBoundaryProps) {
  const route = routePattern(useSegments());
  useEffect(() => {
    report(error, { route });
  }, [error, route]);
  return <ErrorState message="Something went wrong on this screen." onRetry={() => void retry()} />;
}
