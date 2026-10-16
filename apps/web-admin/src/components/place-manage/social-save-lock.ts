// A definite Instagram or Facebook miss disables Save until that link
// changes. The same dead URL must not be sent to Apify again.

export type SocialLock = {
  instagram_url?: string;
  facebook_url?: string;
};

export type SocialDraft = {
  instagram_url: string;
  facebook_url: string;
};

export function socialSaveLocked(
  lock: SocialLock | null,
  draft: SocialDraft | null,
): boolean {
  if (!lock || !draft) return false;
  const watching = lock.instagram_url != null || lock.facebook_url != null;
  if (!watching) return false;
  if (lock.instagram_url != null && draft.instagram_url !== lock.instagram_url) {
    return false;
  }
  if (lock.facebook_url != null && draft.facebook_url !== lock.facebook_url) {
    return false;
  }
  return true;
}
