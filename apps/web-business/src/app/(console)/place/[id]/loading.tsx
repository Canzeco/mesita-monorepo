import { Loader2 } from "lucide-react";

// Business shell Suspense boundary. PlaceHeader + PlaceDock stay mounted
// on the place layout; the page body shows this fallback while a section
// destination fetches its server data.
export default function BusinessShellLoading() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <Loader2
        className="text-muted-foreground h-5 w-5 animate-spin"
        aria-label="Loading"
      />
    </div>
  );
}
