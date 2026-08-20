// Demo Instagram values used until @mesita.bot can read real follower reach.
// Shared by InstagramModal (claim payload) and class-context mock override.
// Mock profile identity (MESITA-935): @mock · 5,000 followers.

// Keep above REACH_ENTRY_CLASS's bar (mirroring classes.follower_threshold)
// or the demo verify flow stops granting a class at all. Not restated as a
// number here: it was written out as 2,000 under the retired "Influencer"
// naming and stayed that way through the move to 1,000 (MESITA-1125), which
// is exactly how a second copy of a threshold goes bad.
export const DEMO_INSTAGRAM_FOLLOWERS = 5000;
export const DEMO_INSTAGRAM_HANDLE = "mock";
