import { Button } from "./button";
import { Notice } from "./notice";

// The destructive confirm (MESITA-3948), on shadcn AlertDialog. First focus
// lands on Cancel. While the action runs, Confirm shows pending, Cancel is
// disabled and Esc does nothing. If the action fails, the dialog stays open
// with the error inside it, both buttons come back and focus sits on Confirm
// so a retry is one keypress. Focus returns to the opener on close.
// This file is the state machine and the panel; dialog.tsx is the lazy
// wrapper and confirm-radix.tsx the Radix half.

export type ConfirmState = { pending: boolean; error: string | null };
export type ConfirmEvent = { type: "start" } | { type: "done" } | { type: "fail"; message: string };

export function confirmReducer(state: ConfirmState, event: ConfirmEvent): ConfirmState {
  switch (event.type) {
    case "start":
      return { pending: true, error: null };
    case "done":
      return { pending: false, error: null };
    case "fail":
      return { pending: false, error: event.message };
  }
}

/** Run the confirmed action; a rejection becomes an in-dialog error, never a close. */
export async function runConfirm(
  action: () => unknown,
  dispatch: (e: ConfirmEvent) => void,
): Promise<"done" | "failed"> {
  dispatch({ type: "start" });
  try {
    await action();
    dispatch({ type: "done" });
    return "done";
  } catch (e) {
    dispatch({ type: "fail", message: e instanceof Error ? e.message : String(e) });
    return "failed";
  }
}

/** Esc closes only when nothing is in flight. */
export function escapeCloses(pending: boolean): boolean {
  return !pending;
}

export type ConfirmCopy = {
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

/** The dialog's buttons and copy; pure, so the pending/failure states render without a DOM. */
export function ConfirmPanel({
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  pending,
  error,
  onConfirm,
  onCancel,
  cancelRef,
  confirmRef,
  Title = "h2",
  Description = "div",
}: ConfirmCopy & {
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  cancelRef?: React.Ref<HTMLButtonElement>;
  confirmRef?: React.Ref<HTMLButtonElement>;
  Title?: React.ElementType;
  Description?: React.ElementType;
}) {
  return (
    <>
      <Title className="font-display text-base font-semibold tracking-tight">{title}</Title>
      <Description asChild={Description !== "div" ? true : undefined}>
        <div className="text-muted-foreground mt-2 text-sm leading-relaxed">{body}</div>
      </Description>
      {error ? <Notice className="mt-3">{error}</Notice> : null}
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button ref={cancelRef} tone="secondary" disabled={pending} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button ref={confirmRef} tone={danger ? "danger" : "primary"} pending={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </>
  );
}

