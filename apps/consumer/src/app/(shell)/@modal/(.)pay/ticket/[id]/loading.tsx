import { Loader2 } from "lucide-react";

export default function PayTicketModalLoading() {
  return (
    <div className="bg-background pointer-events-auto absolute inset-0 z-50 flex items-center justify-center">
      <Loader2
        className="text-muted-foreground h-5 w-5 animate-spin"
        aria-label="Loading ticket"
      />
    </div>
  );
}
