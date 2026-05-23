import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AcceptInviteClient } from "./AcceptInviteClient";

export const dynamic = "force-dynamic";

export default function AcceptInvitePage() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="border-border bg-card w-full max-w-md rounded-2xl border p-6">
        <Suspense
          fallback={
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          }
        >
          <AcceptInviteClient />
        </Suspense>
      </div>
    </main>
  );
}
