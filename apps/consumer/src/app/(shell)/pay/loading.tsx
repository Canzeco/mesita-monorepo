import { PayTabLoading } from "./PayTabLoading";

// Route-level fallback for /pay: the page awaits getUser + the profile EF
// server-side before PayClient mounts. Reusing the PayClient dynamic()
// fallback makes the whole wait read as one continuous frame.
export default function PayRouteLoading() {
  return <PayTabLoading />;
}
