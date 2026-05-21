"use client";

import { useState } from "react";
import Link from "next/link";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import type { AuthFormState } from "@/app/auth/actions";
import { cn } from "@/lib/utils";

// Folds the old /sign-in and /sign-up surfaces into one tabbed control
// at `/`. The parent server page binds the matching server action for
// each mode (signIn vs signUp) and passes both bound actions in — the
// tabs flip which one we render. Pre-selecting the create tab via
// ?mode=signup lets a deep link still land directly on create-account.
//
// Actions stay server-side; this client component just owns the
// in-flight tab state. OAuth lives above both — same provider regardless
// of whether the user is signing in or creating an account.

type BoundAction = (
  prev: AuthFormState,
  formData: FormData,
) => Promise<AuthFormState>;

export function AuthTabs({
  next,
  signInAction,
  signUpAction,
  initialMode = "signin",
}: {
  next: string;
  signInAction: BoundAction;
  signUpAction: BoundAction;
  initialMode?: "signin" | "signup";
}) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);

  return (
    <div className="flex flex-col">
      <OAuthButtons next={next} />

      <div className="my-5 flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
          or
        </span>
        <span className="bg-border h-px flex-1" />
      </div>

      <div className="bg-muted/70 mb-4 grid grid-cols-2 gap-1 rounded-2xl p-1">
        <TabButton active={mode === "signin"} onClick={() => setMode("signin")}>
          Sign in
        </TabButton>
        <TabButton active={mode === "signup"} onClick={() => setMode("signup")}>
          Create account
        </TabButton>
      </div>

      {/* React's reconciler needs different keys here so the form
          state (and the useActionState reducer inside EmailAuthForm)
          reset when the operator flips tabs — otherwise a failed
          sign-in error message would persist into the sign-up form. */}
      {mode === "signin" ? (
        <EmailAuthForm
          key="signin"
          action={signInAction}
          submitLabel="Sign in"
          passwordAutoComplete="current-password"
          minPassword={1}
        />
      ) : (
        <EmailAuthForm
          key="signup"
          action={signUpAction}
          submitLabel="Create account"
          passwordAutoComplete="new-password"
          minPassword={8}
        />
      )}

      <p className="text-muted-foreground mt-6 text-center text-[12.5px]">
        Guest accounts use the{" "}
        <Link
          href="https://guest.mesita.ai"
          className="text-foreground font-semibold hover:underline"
        >
          phone sign-in
        </Link>{" "}
        instead.
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-[13px] font-semibold transition",
        active
          ? "bg-card text-foreground ring-foreground/5 shadow-md ring-1"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
