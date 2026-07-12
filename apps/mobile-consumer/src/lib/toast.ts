// Tiny global toast — RN port of web-consumer `lib/toast.ts`.
// Module-scope listeners so Favorites (and future surfaces) can fire
// `toast.action("Removed…", { label: "Undo", onClick })` without prop-drilling.

type ToastTone = 'info' | 'success' | 'error';

type ToastInput = {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
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
let seq = 0;

function emit() {
  const snap = [...toasts];
  for (const l of listeners) l(snap);
}

function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(input: ToastInput | string): string {
  const cfg: ToastInput =
    typeof input === 'string' ? { message: input } : input;
  const defaultDuration = cfg.action ? 6000 : 3500;
  const t: Toast = {
    id: `t-${++seq}`,
    message: cfg.message,
    tone: cfg.tone ?? 'info',
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

function toastFn(message: string, opts?: Omit<ToastInput, 'message'>): string {
  return push({ message, ...(opts ?? {}) });
}

const toast = Object.assign(toastFn, {
  success(
    message: string,
    opts?: Omit<ToastInput, 'message' | 'tone'>,
  ): string {
    return push({ message, tone: 'success', ...(opts ?? {}) });
  },
  error(message: string, opts?: Omit<ToastInput, 'message' | 'tone'>): string {
    return push({ message, tone: 'error', ...(opts ?? {}) });
  },
  action(
    message: string,
    action: { label: string; onClick: () => void },
    opts?: Omit<ToastInput, 'message' | 'action'>,
  ): string {
    return push({ message, action, ...(opts ?? {}) });
  },
  dismiss,
});

export { toast };

export function subscribeToToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener([...toasts]);
  return () => {
    listeners.delete(listener);
  };
}
