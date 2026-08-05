import { RewardsTabLoading } from "./RewardsTabLoading";

// Route-level fallback for /rewards: the page awaits getUser server-side
// before RewardsClient mounts. Reusing the RewardsClient dynamic()
// fallback makes the whole wait read as one continuous frame.
export default function RewardsRouteLoading() {
  return <RewardsTabLoading />;
}
