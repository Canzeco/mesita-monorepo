// Tiny global toast system.
//
// Backed by a module-scope event target so any client component can fire
// `toast("Saved!")` without prop-drilling, useContext, or pulling in
// Sonner / react-hot-toast. The <Toaster /> component subscribes once,
// renders a stack, and auto-dismisses each toast.
//
// Usage:
//   import { toast } from "@/lib/toast";
//   toast("Saved to your venues");
//   toast("Couldn't save — try again", { tone: "error" });
//   toast.action("Reserved", { label: "View", onClick: () => router.push("/saved") });

export type ToastTone = "info" | "success" | "error";

export type ToastInput = {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
  // Optional inline action button — when present the toast doesn't auto-
  // dismiss until the user either taps it or dismisses manually.
  action?: { label: string; onClick: () => void } | null;
};

export type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
  durationMs: number;
  action: { label: string; onClick: () => void } | null;
};

type Listener = (next: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function emit() {
  // Hand each listener a fresh array reference so React state setters
  // detect the change. Mutating in-place won't trigger a re-render.
  const snap = [...toasts];
  for (const l of listeners) l(snap);
}

function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(input: ToastInput | string): string {
  const cfg: ToastInput = typeof input === "string" ? { message: input } : input;
  // Action toasts hold longer by default because users need a chance to
  // notice + tap the button. 6s feels right — much past that and the user
  // has moved on, much under and they miss it.
  const defaultDuration = cfg.action ? 6000 : 3500;
  const t: Toast = {
    id: crypto.randomUUID(),
    message: cfg.message,
    tone: cfg.tone ?? "info",
    durationMs: cfg.durationMs ?? defaultDuration,
    action: cfg.action ?? null,
  };
  toasts = [...toasts, t];
  emit();
  if (t.durationMs > 0) {
    setTimeout(() => dismiss(t.id), t.durationMs);
  }
  return t.id;
}

// Public API. `toast(...)` is the most common call; the named variants
// keep the call site declarative without losing the option object.
function toastFn(message: string, opts?: Omit<ToastInput, "message">): string {
  return push({ message, ...(opts ?? {}) });
}

const toast = Object.assign(toastFn, {
  success(message: string, opts?: Omit<ToastInput, "message" | "tone">): string {
    return push({ message, tone: "success", ...(opts ?? {}) });
  },
  error(message: string, opts?: Omit<ToastInput, "message" | "tone">): string {
    return push({ message, tone: "error", ...(opts ?? {}) });
  },
  // Convenience for the common "did a thing → 'View'" affordance.
  action(
    message: string,
    action: { label: string; onClick: () => void },
    opts?: Omit<ToastInput, "message" | "action">,
  ): string {
    return push({ message, action, ...(opts ?? {}) });
  },
  dismiss,
});

export { toast };

// For the Toaster component only.
export function subscribeToToasts(listener: Listener): () => void {
  listeners.add(listener);
  // Seed the subscriber with the current snapshot so a late mount still
  // sees any in-flight toasts.
  listener([...toasts]);
  return () => {
    listeners.delete(listener);
  };
}
