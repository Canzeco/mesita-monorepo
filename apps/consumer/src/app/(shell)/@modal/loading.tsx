import { Loader2 } from "lucide-react";

// Modal-slot Suspense fallback for intercepted venue/place routes.
// Keep this explicit and visible so taps on "Info" never look frozen
// (blank screen) while the detail payload is still loading.
export default function ModalLoading() {
  return (
    <div className="bg-background absolute inset-0 z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2
          className="text-foreground h-8 w-8 animate-spin"
          aria-label="Loading venue"
        />
        <p className="text-muted-foreground text-xs font-medium">
          Loading venue info...
        </p>
      </div>
    </div>
  );
}
