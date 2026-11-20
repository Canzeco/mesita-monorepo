"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Screen } from "@/components/consumer/nav/Screen";
import { GeneratePlaceScreen } from "@/components/consumer/search/GeneratePlaceDialog";
import { goBack } from "@/lib/navigate";
import { useOpenPlaceHref } from "@/lib/use-open-place-href";

// Generate (MESITA-4113). Same confirm, same get-or-create. The page stays
// up until the real profile replaces it (MESITA-2957).
function GenerateBody() {
  const params = useSearchParams();
  const router = useRouter();
  const open = useOpenPlaceHref();
  const gid = params.get("gid")?.trim() ?? "";
  const name = params.get("name")?.trim() || "This place";
  const address = params.get("address");

  if (!gid) {
    return (
      <Screen title="Generate" scrolls onBack={() => goBack(router)}>
        <p className="text-muted-foreground p-6 text-center text-sm">
          This place isn&apos;t available.
        </p>
      </Screen>
    );
  }

  return (
    <GeneratePlaceScreen
      target={{ gid, name, address }}
      onClose={() => goBack(router)}
      onGenerated={(opened) => open(opened.href)}
    />
  );
}

export default function GeneratePage() {
  return (
    <Suspense>
      <GenerateBody />
    </Suspense>
  );
}
