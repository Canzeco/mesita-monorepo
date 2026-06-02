import { Loader2 } from "lucide-react";

export default function ExplorePlaceModalLoading() {
  return (
    <div className="bg-background pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center">
      <Loader2
        className="text-muted-foreground h-6 w-6 animate-spin"
        aria-label="Loading place"
      />
    </div>
  );
}
