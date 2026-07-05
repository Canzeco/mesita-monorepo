import { PayTabLoading } from "../PayTabLoading";

// Route-level fallback for /pay/qr and /pay/tickets: the page awaits
// getUser + the profile EF server-side before PayClient even mounts, so
// without this the tab showed the generic shell spinner and THEN the
// PayTabLoading dynamic fallback — two different loading frames. Reusing
// the same skeleton makes the whole wait read as one frame.
export default function PayTabRouteLoading() {
  return <PayTabLoading />;
}
