"use client";

import { PageErrorState } from "@/components/business/PageErrorState";
import { SHELL_ROUTES } from "@/lib/console-routes";

export default function ShellError() {
  return (
    <PageErrorState
      heading="Something broke"
      message="The console hit an error rendering this page."
      retryHref={SHELL_ROUTES.organization}
    />
  );
}
