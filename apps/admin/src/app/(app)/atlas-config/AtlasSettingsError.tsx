import { AlertTriangle } from "lucide-react";

export function AtlasSettingsError({ error }: { error: string }) {
  return (
    <div className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-3 rounded-2xl border p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="font-medium">{error}</p>
    </div>
  );
}
