"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiAcceptEditorInvite } from "@/lib/api/team";
import { placePath } from "@/lib/business-route-contract";
import { errMsg } from "@/lib/utils";

// Business-side accept page. The staff accept flow runs from WhatsApp /
// SMS via staff-accept-invite and never lands here.
//
// Two preconditions: (1) a `token` query param, (2) a signed-in
// auth.user. If the user isn't signed in we bounce them to the sign-in
// page with a ?next=... pointing back here so the token isn't lost.

type Status = "claiming" | "needs_signin" | "success" | "error";

function initialFromParams(
  token: string | null,
  kind: string | null,
): { status: Status; message: string } {
  if (!token) return { status: "error", message: "Missing invite token." };
  if (kind === "staff") {
    return {
      status: "error",
      message:
        "This invite is for a staff — open it in WhatsApp on the validator's phone.",
    };
  }
  return { status: "claiming", message: "" };
}

export function AcceptInviteClient() {
  const supabase = useBrowserSupabase();
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const kind = params.get("kind"); // "staff" → wrong app

  const initial = initialFromParams(token, kind);
  const [status, setStatus] = useState<Status>(initial.status);
  const [message, setMessage] = useState<string>(initial.message);
  const [projectId, setPlaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!token || kind === "staff") return; // static error already rendered

    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setStatus("needs_signin");
        return;
      }
      try {
        const res = await apiAcceptEditorInvite(supabase, token);
        if (cancelled) return;
        setPlaceId(res.projectId);
        setStatus("success");
        window.setTimeout(() => {
          router.replace(placePath(res.projectId));
        }, 1200);
      } catch (err) {
        if (cancelled) return;
        setMessage(errMsg(err, "Couldn't claim that invite."));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, token, kind, router]);

  if (status === "claiming") {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Joining your team…
      </div>
    );
  }

  if (status === "needs_signin") {
    const next = `/accept-invite?token=${encodeURIComponent(token ?? "")}`;
    return (
      <div className="flex flex-col gap-3">
        <p className="font-display text-lg font-semibold">Sign in to join</p>
        <p className="text-muted-foreground text-sm">
          Sign in with the email this invite was sent to, then we&apos;ll add
          you to the place.
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

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="text-whatsapp-deep h-10 w-10" />
        <p className="font-display text-lg font-semibold">You&apos;re in.</p>
        <p className="text-muted-foreground text-sm">
          Redirecting to the place dashboard…
        </p>
        {projectId && (
          <Link
            href={placePath(projectId)}
            className="text-secondary text-xs font-semibold"
          >
            Open now
          </Link>
        )}
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
