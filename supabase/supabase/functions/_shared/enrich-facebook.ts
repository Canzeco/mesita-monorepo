// Atlas source — Apify Facebook page (followers). Social-layer.
// The scrape itself is the shared verifier. This shape is what First's
// beacon still reads.

import { verifyFacebook } from "./review-sources.ts";

export type FacebookResult = {
  fbFollowers: number | null;
  diag: Record<string, unknown>;
};

export async function gatherFacebook(opts: {
  apifyKey: string;
  facebookUrl: string;
}): Promise<FacebookResult> {
  const verified = await verifyFacebook(opts.facebookUrl, opts.apifyKey);
  return {
    fbFollowers: verified.found ? verified.metrics.facebook_followers : null,
    diag: {
      ok: verified.found,
      ...(verified.reason ? { error: verified.reason } : {}),
    },
  };
}
