"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "./button";
import { SectionCard as KitSectionCard } from "./card";
import { BONE_CLASS as KIT_BONE_CLASS, CARD_CLASS, CARD_SURFACE_CLASS as KIT_SURFACE } from "./classes";
import { TextField as KitTextField, TextAreaField } from "./field";
import { INPUT_CLASS } from "./ui/input";

// `@/components/admin-ui/manage` — dissolved into the kit (MESITA-3948).
// Everything here is a deprecated wrapper or re-export that renders the one
// skin until Waves 2–3 move the callers to "@/components/admin-ui".

/** @deprecated the card paints its icon muted; Waves 2–3 delete every `tint=`. */
export type Tint =
  | "rose"
  | "pink"
  | "amber"
  | "sky"
  | "violet"
  | "emerald"
  | "teal"
  | "orange"
  | "indigo"
  | "slate";

/** @deprecated use { SectionCard } from "@/components/admin-ui" */
export const CARD_SURFACE_CLASS = KIT_SURFACE;
/** @deprecated use { SectionCard } or { Skeleton } from "@/components/admin-ui" */
export const SECTION_CARD_CLASS = CARD_CLASS;
/** @deprecated use { Skeleton } from "@/components/admin-ui" */
export const BONE_CLASS = KIT_BONE_CLASS;
/** @deprecated use { TextField } from "@/components/admin-ui" */
export const INPUT_BASE = INPUT_CLASS;

/** @deprecated use { PhoneField, ReadField, Spinner, ConfirmDialog } from "@/components/admin-ui" */
export { PhoneField, ReadField } from "./field";
/** @deprecated use { Spinner } from "@/components/admin-ui" */
export { Spinner } from "./states";
/** @deprecated use { ConfirmDialog } from "@/components/admin-ui" */
export { ConfirmDialog } from "./dialog";

/**
 * @deprecated use { SectionCard } from "@/components/admin-ui" with `right`.
 * Wave 1 wrapper: `action` maps to `right`; `tint` is accepted and ignored.
 */
export function SectionCard({
  id,
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  id?: string;
  icon?: React.ReactNode;
  /** @deprecated ignored: the card paints its icon muted */
  tint?: Tint;
  title: string;
  subtitle?: string;
  /** @deprecated pass `right` to the kit SectionCard */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <KitSectionCard id={id} icon={icon} title={title} subtitle={subtitle} right={action}>
      {children}
    </KitSectionCard>
  );
}

/** @deprecated use { TextField } from "@/components/admin-ui" */
export function TextField(props: {
  label: string;
  icon?: React.ReactNode;
  leading?: React.ReactNode;
  labelRight?: React.ReactNode;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  disabled?: boolean;
  maxLength?: number;
}) {
  return <KitTextField {...props} />;
}

/** @deprecated use { TextAreaField } from "@/components/admin-ui" */
export function TextArea(props: {
  label: string;
  labelRight?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  return <TextAreaField {...props} />;
}

/** @deprecated use { Button } from "@/components/admin-ui" with `href` and tone="ghost" size="sm" */
export function OpenLink({ href }: { href: string }) {
  const trimmed = href.trim();
  const url = /^(https?|tel|mailto|sms):/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return (
    <Button href={url} tone="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
      Open
      <ExternalLink aria-hidden className="h-3 w-3" />
    </Button>
  );
}

/** @deprecated use { Button } from "@/components/admin-ui" with tone="ghost" size="sm" */
export function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      tone="ghost"
      size="sm"
      icon={copied ? <Check aria-hidden className="h-3.5 w-3.5" /> : <Copy aria-hidden className="h-3.5 w-3.5" />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(id);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard unavailable — ignore */
        }
      }}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
