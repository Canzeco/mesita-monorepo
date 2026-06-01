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
            <div className="flex items-center justify-center py-2">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" aria-label="Loading" />
            </div>
          }
        >
          <AcceptInviteClient />
        </Suspense>
      </div>
    </main>
  );
}
