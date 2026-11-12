"use client";

import { useState } from "react";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { PhoneOtpForm } from "./PhoneOtpForm";
import { EmailOtpForm } from "./EmailOtpForm";
import { cn } from "@/lib/utils";

// The sign-in sheet's body (MESITA-3777): Continue with Google first, one
// tap; an "or" rule; then a code, by phone (the default) or by email. Google
// is left out inside app webviews, where Google refuses to sign in; email
// shows only once the cloud can send it (NEXT_PUBLIC_EMAIL_SIGNIN=on).
type Method = "phone" | "email";

export function SignInOptions({
  redirectAfter,
  next,
  showGoogle,
  showEmail,
}: {
  redirectAfter: string;
  /** The raw `?next=`, handed to Google's round trip. */
  next?: string;
  showGoogle: boolean;
  showEmail: boolean;
}) {
  const [method, setMethod] = useState<Method>("phone");

  return (
    <div className="flex flex-col gap-5">
      {showGoogle && (
        <>
          <GoogleSignInButton next={next} />
          <div className="text-muted-foreground flex items-center gap-3 text-xs" aria-hidden>
            <span className="bg-border h-px flex-1" />
            or
            <span className="bg-border h-px flex-1" />
          </div>
        </>
      )}
      {showEmail && (
        <div role="tablist" aria-label="Get a code by" className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1">
          {(["phone", "email"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={method === m}
              onClick={() => setMethod(m)}
              className={cn(
                "h-9 rounded-md text-sm font-semibold transition",
                method === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {m === "phone" ? "Phone" : "Email"}
            </button>
          ))}
        </div>
      )}
      {method === "email" && showEmail ? (
        <EmailOtpForm redirectAfter={redirectAfter} />
      ) : (
        <PhoneOtpForm redirectAfter={redirectAfter} />
      )}
    </div>
  );
}
