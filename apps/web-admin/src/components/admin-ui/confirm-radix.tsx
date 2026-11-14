"use client";

import { useEffect, useReducer, useRef } from "react";
import {
  confirmReducer,
  ConfirmPanel,
  escapeCloses,
  runConfirm,
  type ConfirmCopy,
} from "./confirm-core";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./ui/alert-dialog";

// The Radix half of ConfirmDialog, loaded on first open (see dialog.tsx).

function ConfirmBody({
  busy,
  error: controlledError,
  onConfirm,
  onCancel,
  ...copy
}: ConfirmCopy & {
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

export function ConfirmDialogRadix({
  open,
  onCancel,
  ...rest
}: ConfirmCopy & {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => unknown;
  onCancel: () => void;
}) {
  // Focus returns to whatever opened the dialog.
  const opener = useRef<HTMLElement | null>(
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  useEffect(() => {
    const el = opener.current;
    return () => el?.focus();
  }, []);
  return (
    <AlertDialog open={open}>
      <ConfirmBody {...rest} onCancel={onCancel} />
    </AlertDialog>
  );
}
