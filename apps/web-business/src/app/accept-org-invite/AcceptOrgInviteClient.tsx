"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiAcceptOrgInvite } from "@/lib/api/organizations";
import { SHELL_ROUTES, withOrg } from "@/lib/console-routes";
import { errMsg } from "@/lib/utils";

// Organization-invite accept page (MESITA-1550) — a sibling of
// AcceptInviteClient rather than a shared component: the two invite kinds
// carry different copy throughout ("join this organization" vs "join this
// place's team") and almost no logic beyond reading a token query param, so
// branching one component on invite-kind would add complexity for no reuse.
//
// Two preconditions: (1) a `token` query param, (2) a signed-in auth.user.
// If the user isn't signed in we bounce them to sign-in with a ?next=...
// pointing back here so the token isn't lost.

type State = "claiming" | "needs_signin" | "success" | "error";

function initialFromParams(token: string | null): {
  state: State;
  message: string;
} {
  if (!token) return { state: "error", message: "Missing invite token." };
  return { state: "claiming", message: "" };
}

export function AcceptOrgInviteClient() {
  const supabase = useBrowserSupabase();
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");

  const initial = initialFromParams(token);
  const [state, setState] = useState<State>(initial.state);
  const [message, setMessage] = useState<string>(initial.message);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return; // static error already rendered

    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setState("needs_signin");
        return;
      }
      try {
        const res = await apiAcceptOrgInvite(supabase, token);
        if (cancelled) return;
        setOrganizationId(res.organizationId);
        setState("success");
        window.setTimeout(() => {
          router.replace(withOrg(SHELL_ROUTES.organization, res.organizationId));
        }, 1200);
      } catch (err) {
        if (cancelled) return;
        setMessage(errMsg(err, "Couldn't claim that invite."));
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, token, router]);

  if (state === "claiming") {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Joining the organization…
      </div>
    );
  }

  if (state === "needs_signin") {
    const next = `/accept-org-invite?token=${encodeURIComponent(token ?? "")}`;
    return (
      <div className="flex flex-col gap-3">
        <p className="font-display text-lg font-semibold">Sign in to join</p>
        <p className="text-muted-foreground text-sm">
          Sign in with the email this invite was sent to, then we&apos;ll add
          you to the organization.
        </p>
        <Link
          href={`/?next=${encodeURIComponent(next)}`}
          className="bg-foreground text-background mt-2 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold"
        >
          Continue to sign in
        </Link>
      </div>
    );
  }

  if (state === "success") {
    const href = organizationId
      ? withOrg(SHELL_ROUTES.organization, organizationId)
      : SHELL_ROUTES.organization;
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="text-whatsapp-deep h-10 w-10" />
        <p className="font-display text-lg font-semibold">You&apos;re in.</p>
        <p className="text-muted-foreground text-sm">
          Redirecting to the organization…
        </p>
        <Link href={href} className="text-secondary text-xs font-semibold">
          Open now
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <XCircle className="text-destructive h-10 w-10" />
      <p className="font-display text-lg font-semibold">Couldn&apos;t join</p>
      <p className="text-muted-foreground text-sm">{message}</p>
      <Link href="/" className="text-secondary text-xs font-semibold">
        Back home
      </Link>
    </div>
  );
}
