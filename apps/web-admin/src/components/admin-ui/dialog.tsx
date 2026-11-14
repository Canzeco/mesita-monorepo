"use client";

import dynamic from "next/dynamic";
import type { ConfirmCopy } from "./confirm-core";

// The destructive confirm (MESITA-3948). Radix loads only when a dialog first
// opens (confirm-radix.tsx): the barrel reaches every page, and a closed
// dialog should cost nothing. Behaviour lives in confirm-core.tsx.

const ConfirmDialogRadix = dynamic(() => import("./confirm-radix").then((m) => m.ConfirmDialogRadix), {
  ssr: false,
});

/**
 * Controlled by the caller: `open`, `onCancel`, and `onConfirm` (sync or a
 * promise; the caller closes on success). `busy`/`error` may also be passed
 * by a caller that tracks the write itself.
 */
export function ConfirmDialog(
  props: ConfirmCopy & {
    open: boolean;
    busy?: boolean;
    error?: string | null;
    onConfirm: () => unknown;
    onCancel: () => void;
  },
) {
  return props.open ? <ConfirmDialogRadix {...props} /> : null;
}
