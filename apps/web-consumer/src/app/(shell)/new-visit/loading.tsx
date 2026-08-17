import { NewVisitLoading } from "./NewVisitLoading";

// Route-level fallback for /rewards: the page awaits getUser server-side
// before NewVisitClient mounts. Reusing the NewVisitClient dynamic()
// fallback makes the whole wait read as one continuous frame.
export default function NewVisitRouteLoading() {
  return <NewVisitLoading />;
}
