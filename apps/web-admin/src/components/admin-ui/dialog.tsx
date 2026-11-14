"use client";

import { useEffect, useReducer, useRef } from "react";
import { Button } from "./button";
import { Notice } from "./notice";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./ui/alert-dialog";

// The destructive confirm (MESITA-3948), on shadcn AlertDialog. First focus
// lands on Cancel. While the action runs, Confirm shows pending, Cancel is
// disabled and Esc does nothing. If the action fails, the dialog stays open
// with the error inside it, both buttons come back and focus sits on Confirm
// so a retry is one keypress. Focus returns to the opener on close.

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

type Copy = {
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
}: Copy & {
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

function ConfirmBody({
  busy,
  error: controlledError,
  onConfirm,
  onCancel,
  ...copy
}: Copy & {
  busy?: boolean;
  error?: string | null;
  onConfirm: () => unknown;
  onCancel: () => void;
}) {
  const [state, dispatch] = useReducer(confirmReducer, { pending: false, error: null });
  const pending = !!busy || state.pending;
  const error = controlledError ?? state.error;
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  useEffect(() => {
    if (error && !pending) confirmRef.current?.focus();
  }, [error, pending]);

  return (
    <AlertDialogContent
      onEscapeKeyDown={(e) => {
        // The dialog is controlled: Radix never closes it, the caller does.
        e.preventDefault();
        if (escapeCloses(pending)) onCancel();
      }}
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      <ConfirmPanel
        {...copy}
        pending={pending}
        error={error}
        cancelRef={cancelRef}
        confirmRef={confirmRef}
        Title={AlertDialogTitle}
        Description={AlertDialogDescription}
        onCancel={() => {
          if (!pending) onCancel();
        }}
        onConfirm={() => {
          if (!pending) void runConfirm(onConfirm, dispatch);
        }}
      />
    </AlertDialogContent>
  );
}

/**
 * Controlled by the caller: `open`, `onCancel`, and `onConfirm` (sync or a
 * promise; the caller closes on success). `busy`/`error` may also be passed
 * by a caller that tracks the write itself.
 */
export function ConfirmDialog({
  open,
  onCancel,
  ...rest
}: Copy & {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => unknown;
  onCancel: () => void;
}) {
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => opener.current?.focus();
  }, [open]);
  return (
    <AlertDialog open={open}>
      {open ? <ConfirmBody {...rest} onCancel={onCancel} /> : null}
    </AlertDialog>
  );
}
