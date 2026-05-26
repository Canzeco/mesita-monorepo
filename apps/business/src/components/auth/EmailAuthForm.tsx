"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import type { AuthFormState } from "@/app/auth/actions";
import { Field } from "@/components/shared";
import {
  ERROR_BOX_CLASS,
  INFO_BOX_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

// Email + password form used by both business and admin sign-in/sign-up
// surfaces. Spec is intentionally narrow — no magic link, no OAuth.
//
// The bound server action handles the signInWithPassword / signUp call
// + redirect; the post-signin EF (business-signin-email or admin-signin-
// email) runs from the /auth/post-signin server page that the action
// redirects to.

type BoundAction = (
  prev: AuthFormState,
  formData: FormData,
) => Promise<AuthFormState>;

export function EmailAuthForm({
  action,
  submitLabel,
  passwordAutoComplete = "current-password",
  minPassword = 8,
}: {
  action: BoundAction;
  submitLabel: string;
  passwordAutoComplete?: "current-password" | "new-password";
  // Sign-up uses 8+ (matches the server action); sign-in passes 1 so the
  // browser doesn't show a "min 8" tooltip on an existing short password.
  minPassword?: number;
}) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field label="Email">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          className={INPUT_CLASS}
          placeholder="you@example.com"
        />
      </Field>

      <Field label="Password">
        <input
          type="password"
          name="password"
          required
          minLength={minPassword}
          maxLength={72}
          autoComplete={passwordAutoComplete}
          className={INPUT_CLASS}
          placeholder="••••••••"
        />
      </Field>

      {state?.error && (
        <p className={cn(ERROR_BOX_CLASS, "leading-relaxed")}>{state.error}</p>
      )}
      {state?.info && <p className={INFO_BOX_CLASS}>{state.info}</p>}

      <button
        type="submit"
        disabled={pending}
        className={cn(PRIMARY_BUTTON_CLASS, "mt-2")}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
      </button>
    </form>
  );
}
