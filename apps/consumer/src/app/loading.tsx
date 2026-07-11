import { Spinner } from "@/components/shared";

// Root loading boundary — the only loading UI OUTSIDE the (shell) segment.
// Covers hard navigations into the pre-shell surfaces (/, /onboard,
// /auth/post-signin), which previously flashed a blank white page while
// their server components resolved. Full-height brand-gradient splash with
// the shared spinner so the very first paint already reads as Mesita.
export default function RootLoading() {
  return (
    <div className="bg-hero flex min-h-dvh w-full items-center justify-center">
      <Spinner
        size="lg"
        label="Loading Mesita"
        className="border-primary/20 border-t-primary"
      />
    </div>
  );
}
