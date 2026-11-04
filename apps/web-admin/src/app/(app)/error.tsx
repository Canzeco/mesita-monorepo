"use client";

import { PageErrorState } from "@/components/admin-ui/PageErrorState";

// A page that crashed, with the rail still usable (MESITA-3261). Try again is
// a full reload, not Next's reset: Admin has no deployment watcher, so a tab
// left open across a deploy crashes on a file that no longer exists, and only
// a reload fixes that. It covers every other crash the same way.
export default function AppError() {
  return (
    <PageErrorState
      heading="Something went wrong"
      message="This page hit an error. Reloading usually fixes it."
      onRetry={() => window.location.reload()}
    />
  );
}
