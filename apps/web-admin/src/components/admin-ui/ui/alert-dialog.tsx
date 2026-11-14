"use client";

import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import { cn } from "../cn";
import { OVERLAY_SURFACE_CLASS } from "../classes";

// shadcn `alert-dialog`, edited to the admin skin: the overlay surface, the
// `bg-black/50` scrim, no tw-animate classes. The kit's ConfirmDialog draws
// its own buttons, so Action/Cancel are not re-exported.
const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTitle = AlertDialogPrimitive.Title;
const AlertDialogDescription = AlertDialogPrimitive.Description;

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay data-slot="alert-dialog-overlay" className="fixed inset-0 z-50 bg-black/50" />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          OVERLAY_SURFACE_CLASS,
          "fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 p-5",
          className,
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

export { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription };
