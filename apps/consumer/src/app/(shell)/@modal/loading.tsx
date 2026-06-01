import { Loader2 } from "lucide-react";

// Modal-slot Suspense fallback for intercepted venue/place routes.
// Keep this explicit and visible so taps on "Info" never look frozen
// (blank screen) while the detail payload is still loading.
export default function ModalLoading() {
  return (
    <div className="bg-background absolute inset-0 z-50 flex items-center justify-center">
      <Loader2
        className="text-muted-foreground h-5 w-5 animate-spin"
        aria-label="Loading venue"
      />
    </div>
  );
}
