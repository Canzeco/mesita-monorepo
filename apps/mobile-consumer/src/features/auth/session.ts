import { onRefusal, type Refusal } from "@/lib/edge";
import { dropPushInstall, retryDropPush } from "@/lib/push";
import { followDevice, forgetReads, keepReads } from "@/lib/query";
import { report } from "@/lib/report";
import { dropSession, followAppState, storedGuestId, supabase } from "@/lib/supabase";

import { deleteMyAccount, recordSignIn } from "./api";
import { getSession, setSession } from "./store";
import { forgetTarget, settleTarget } from "./target";

// What moves the session. Screens call these; nothing else does.

const STORAGE_MS = 5000;

async function adopt(guestId: string): Promise<void> {
  await keepReads(guestId).catch(() => undefined);
  setSession({ guestId });
}

/** Read the device's own storage, with no network. If it has not answered in
 *  five seconds the app opens as anonymous and adopts a late session. */
export async function start(): Promise<void> {
  const settle = () => {
    if (getSession().settled) return;
    settleTarget(getSession().guestId !== null);
    setSession({ settled: true });
  };
  const slow = setTimeout(() => {
    report(new Error("storage_slow"), { name: "storage_slow" });
    settle();
  }, STORAGE_MS);
  try {
    const guestId = await storedGuestId();
    // A sign-in finished while a slow storage was still answering wins.
    if (guestId && getSession().guestId === null) {
      await adopt(guestId);
      if (getSession().settled) settleTarget(true);
    }
  } catch (err) {
    report(err);
  } finally {
    clearTimeout(slow);
    settle();
  }
}

/** Everything that listens for as long as the app runs. */
export function listen(): () => void {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    // Auth itself refused the session. An explicit sign-out clears first.
    if (event === "SIGNED_OUT" && getSession().guestId !== null) void expire();
  });
  if (getSession().guestId !== null) void retryDropPush();
  const stops = [followAppState(), followDevice(), onRefusal(hear), () => data.subscription.unsubscribe()];
  return () => stops.forEach((stop) => stop());
}

export function hear(refusal: Refusal): void {
  if (refusal.code === "update_app") setSession({ updateRequired: true });
  else if (refusal.code === "suspended") {
    if (getSession().suspended === null) void forgetReads(getSession().guestId);
    setSession({ suspended: refusal.message });
  } else if (getSession().guestId !== null) void expire();
}

async function leave(notice: string | null): Promise<void> {
  const { guestId } = getSession();
  setSession({ guestId: null, suspended: null, onboarded: true, notice });
  settleTarget(false);
  await forgetReads(guestId);
  await dropSession();
}

/** The session died: anonymous again, and sign-in says why. */
export function expire(): Promise<void> {
  return leave("You were signed out. Sign in again.");
}

export async function signOut(): Promise<void> {
  forgetTarget();
  await dropPushInstall().catch(() => undefined);
  return leave(null);
}

export async function deleteAccount(): Promise<void> {
  await deleteMyAccount();
  await signOut();
}

export async function sendCode(phone: string) {
  return (await supabase.auth.signInWithOtp({ phone })).error;
}

/** Check the code, then make the guest's row. The session exists as soon as
 *  the code is right, so a failed second step never undoes the sign-in. */
export async function verifyCode(phone: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) return error;
  const guestId = data.user?.id;
  if (!guestId) return new Error("token");
  const signedIn = await recordSignIn().catch((err) => {
    report(err);
    return null;
  });
  settleTarget(true);
  setSession({ notice: null, onboarded: signedIn?.onboarded ?? true });
  await adopt(guestId);
  return null;
}
