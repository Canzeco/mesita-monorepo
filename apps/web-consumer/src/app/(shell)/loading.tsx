import { headers } from "next/headers";

import { ShellLoadingFor } from "./shell-loading";

// Children-slot Suspense fallback for the (shell) segment: what a tap on the
// bar from Me, Pay or Share paints while the target is in flight. It draws
// the target's placeholder, never a spinner (MESITA-2840).
export default async function ConsumerShellLoading() {
  const bare = (await headers()).get("x-bare-pathname") ?? "/";
  return <ShellLoadingFor bare={bare} />;
}
