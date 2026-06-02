import { Loader2 } from "lucide-react";

// Modal routes can fetch server-side data. Keep a neutral spinner fallback
// here so no route briefly shows miniature placeholder UI.
export default function ModalLoading() {
  return (
    <div className="bg-background pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center">
      <Loader2
        className="text-muted-foreground h-5 w-5 animate-spin"
        aria-label="Loading modal"
      />
    </div>
  );
}
