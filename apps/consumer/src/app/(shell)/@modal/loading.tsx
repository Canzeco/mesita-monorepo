import { Loader2 } from "lucide-react";

// Modal-slot Suspense fallback for intercepted venue/place routes.
// Keep this explicit and visible so taps on "Info" never look frozen
// (blank screen) while the detail payload is still loading.
export default function ModalLoading() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex justify-center pb-24">
      <div className="bg-card/92 border-border rounded-full border px-3 py-2 shadow-sm backdrop-blur">
        <Loader2
          className="text-muted-foreground h-5 w-5 animate-spin"
          aria-label="Loading venue"
        />
      </div>
    </div>
  );
}
