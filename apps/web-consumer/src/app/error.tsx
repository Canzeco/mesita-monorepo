"use client";

import { RouteError } from "@/components/consumer/RouteError";

// Everything outside the shell (sign-in, onboarding) and the shell layout
// itself: a throw lands on RouteError, never Next's bare page (MESITA-2993).
export default function RootError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <main className="flex min-h-dvh w-full flex-col">
      <RouteError error={error} retry={retry} />
    </main>
  );
}
