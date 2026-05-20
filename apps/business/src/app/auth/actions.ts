"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { isEmail } from "@/lib/validators";

// Manager auth: email + password (these actions) plus Google / Apple OAuth
// (handled by OAuthButtons + /auth/callback). No magic link, no password
// reset (managers will self-serve via a dedicated flow once we ship it).
// Sign-in / sign-up are server actions so the session cookie lands on the
// SSR client; the role stamping + profile creation happens on
// /auth/post-signin which calls manager-signin-email.

export type AuthFormState = {
  error?: string;
  info?: string;
} | null;

export async function authSignInWithEmail(
  redirectTo: string,
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const lower = error.message.toLowerCase();
    if (
      lower.includes("invalid login credentials") ||
      lower.includes("invalid_grant")
    ) {
      return {
        error:
          "We couldn't sign you in with that email and password. Check the address or create an account if you haven't yet.",
      };
    }
    if (lower.includes("email not confirmed")) {
      return {
        error:
          "Your account exists but the email hasn't been confirmed yet. Check your inbox.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function authSignUpWithEmail(
  redirectTo: string,
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (!isEmail(email)) {
    return { error: "That doesn't look like a valid email." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password.length > 72) {
    return { error: "Password is too long — keep it under 72 characters." };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    const lower = error.message.toLowerCase();
    if (
      lower.includes("already") ||
      lower.includes("registered") ||
      lower.includes("exists")
    ) {
      // Smart-signup fallback: collapse "did I already register?" into
      // a single button by attempting sign-in with the same credentials.
      const signIn = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!signIn.error) {
        revalidatePath("/", "layout");
        redirect(redirectTo);
      }
      return {
        error:
          "This email is already on a Mesita account, but the password doesn't match. Sign in with your existing password.",
      };
    }
    return { error: error.message };
  }

  if (!data.session) {
    return {
      info: "Account created. Check your inbox to confirm your email, then sign in.",
    };
  }

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function authSignOut(redirectTo: string, _formData: FormData) {
  void _formData;
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(redirectTo);
}
