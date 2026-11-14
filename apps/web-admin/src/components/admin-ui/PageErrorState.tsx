import { Button } from "./button";

// A whole page that failed, inside the pane, under the page's own margins.
export function PageErrorState({
  heading,
  message,
  onRetry,
}: {
  heading: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="px-4 pt-6 pb-10 sm:px-6 sm:pt-8 lg:px-8">
      <div className="border-destructive/40 bg-destructive/5 rounded-2xl border p-10 text-center">
        <h2 className="font-display text-destructive text-xl font-semibold tracking-tight">{heading}</h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">{message}</p>
        <Button className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
