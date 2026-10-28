"use client";

import { RouteError } from "@/components/consumer/RouteError";

// A screen under the shell that throws keeps the frame and the tab bar;
// only the body becomes RouteError (MESITA-2993).
export default function ShellError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return <RouteError error={error} retry={retry} />;
}
