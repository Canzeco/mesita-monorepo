"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ManageMultipleTabs } from "./TabNav";
import { MULTIPLE_SUBROUTES } from "./nav";

const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/manage-multiple/catalog":
    "Browse every unit already on Mesita. Open any row to edit it in the single-unit console.",
  "/manage-multiple/search":
    "Run many Google Places text searches at once and export Place IDs for bulk create.",
  "/manage-multiple/create":
    "Create many units from Google Place IDs — same pipeline as single create, with progress per row.",
  "/manage-multiple/update":
    "Upload a CSV of venue IDs and fields to overwrite, with a diff preview before commit.",
};

export function ManageMultipleLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const match = MULTIPLE_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  const description =
    (match && SUBPAGE_DESCRIPTION[match.href]) ??
    SUBPAGE_DESCRIPTION["/manage-multiple/catalog"];

  return (
    <>
      <PageHeader title="Manage Multiple Units" description={description} />
      <ManageMultipleTabs />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
