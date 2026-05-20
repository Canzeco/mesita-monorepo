import { AlertTriangle } from "lucide-react";
import { listVerifications } from "./actions";
import { VerificationsClient } from "./VerificationsClient";

export const dynamic = "force-dynamic";

export default async function VerificationsPage() {
  const result = await listVerifications();

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-5xl px-8 pt-12 pb-14">
        <Header />
        <div className="border-destructive/40 bg-destructive/5 text-destructive mt-8 flex items-start gap-3 rounded-2xl border p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-medium">{result.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-8 pt-12 pb-14">
      <Header />
      <VerificationsClient
        initialVerifications={result.data.verifications}
        initialAutoVerify={result.data.autoVerifyVenues}
        initialAutoVerifyUpdatedAt={result.data.autoVerifyUpdatedAt}
      />
    </div>
  );
}

function Header() {
  return (
    <>
      <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
        Units · Verification queue
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        Unit verification requests
      </h1>
      <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
        Managers submit one of three methods (AI call, video, postcard) to
        prove they operate the venue they just created. Approve to flip the
        venue to active; reject with a reason and they can submit a fresh
        request.
      </p>
    </>
  );
}
