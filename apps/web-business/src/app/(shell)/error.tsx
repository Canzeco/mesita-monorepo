"use client";

import { PageErrorState } from "@/components/business/PageErrorState";

export default function ShellError() {
  return (
    <PageErrorState
      heading="Something broke"
      message="The console hit an error rendering this page."
      retryHref="/"
    />
  );
}
