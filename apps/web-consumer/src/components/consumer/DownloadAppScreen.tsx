import Link from "next/link";
import { Smartphone } from "lucide-react";

import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { prefixPath } from "@/lib/surface";
import { EmptyState } from "@/components/shared/EmptyState";

/** /web has no signup — wallet, visits, and profile live in the native app. */
export function DownloadAppScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EmptyState
        icon={Smartphone}
        title="Get the Mesita app"
        description="The full site is for browsing places and maps. Sign in, pay at a table, wallet, and your profile are in the iOS and Android app."
        action={{ label: "Download Mesita", href: "https://mesita.ai" }}
      />
      <p className="type-meta text-muted-foreground pb-8 text-center">
        <Link
          href={prefixPath("web", CONSUMER_ROUTES.discoverDefault)}
          className="text-primary font-medium"
        >
          Keep browsing on the web
        </Link>
        {" · "}
        <Link href="/mob" className="text-primary font-medium">
          Phone emulator
        </Link>
      </p>
    </div>
  );
}
