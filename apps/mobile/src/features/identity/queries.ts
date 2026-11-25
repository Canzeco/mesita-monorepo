import { useMutation } from "@tanstack/react-query";

import { rereadMyProfile, setMyProfile, setSession, useSession } from "@/features/auth";
import { isOutcomeUnknown, reconcile } from "@/lib/reconcile";

import { saveMyDetails } from "./api";
import { wasSaved, type Details } from "./model";

/** Saving my details. Sent once: if its answer is lost, the profile is
 *  re-read and the re-read is the answer. */
export function useSaveDetails() {
  const { guestId } = useSession();
  return useMutation({
    mutationFn: (details: Details) => saveDetails(guestId, details),
    onSuccess: () => setSession({ onboarded: true }),
  });
}

export async function saveDetails(
  guestId: string | null,
  details: Details,
  wait?: (ms: number) => Promise<unknown>,
): Promise<void> {
  try {
    setMyProfile(await saveMyDetails(details));
  } catch (err) {
    if (!guestId || !isOutcomeUnknown(err)) throw err;
    const saved = await reconcile(async () => wasSaved(await rereadMyProfile(guestId), details), wait);
    if (!saved) throw err;
  }
}
