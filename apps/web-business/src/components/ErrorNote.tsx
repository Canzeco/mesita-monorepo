import { AlertTriangle } from "lucide-react";

// Inline destructive notice — a hairline-bordered box with a warning glyph,
// used across the admin console for form/section errors. Single source so the
// three former copies (manage-single, enricher-config, admin-config) can't
// drift apart.
export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="border-destructive/40 bg-destructive/5 text-destructive mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p className="font-medium">{message}</p>
    </div>
  );
}
