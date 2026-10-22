import { InstagramSkeleton } from "./InstagramSkeleton";

// /me/instagram's fallback: the connect page as it first paints, for this
// guest's side of it (connected or not). See InstagramSkeleton.
export default function InstagramLoading() {
  return <InstagramSkeleton />;
}
