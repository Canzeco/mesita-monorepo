"use client";

import { ConfigTabsLayout } from "@/components/ConfigTabsLayout";
import { MULTIPLE_SUBROUTES } from "./nav";

const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/manage-multiple/search":
    "Run many Google Places text searches at once and export Place IDs for bulk create.",
  "/manage-multiple/create":
    "Create many units from Google Place IDs — same pipeline as single create, with progress per row.",
  "/manage-multiple/update":
    "Upload a CSV of place IDs and fields to overwrite, with a diff preview before commit.",
};

export function ManageMultipleLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigTabsLayout
      title="Manage Multiple Units"
      subroutes={MULTIPLE_SUBROUTES}
      descriptions={SUBPAGE_DESCRIPTION}
    >
      {children}
    </ConfigTabsLayout>
  );
}
