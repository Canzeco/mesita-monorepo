import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { CreateUnitForm } from "./CreateUnitForm";

// Route lives at /add. Distinct from /manager/onboard:
// onboard creates the manager_profile (once per person), create_unit
// creates a venue (N times per person — multi-unit operators).
//
// Renders full-screen on purpose: this route sits OUTSIDE manager/(shell),
// so the Sidebar is intentionally absent. Picking a Google profile is a
// one-shot focused action — nav chrome would just compete for attention.
export const dynamic = "force-dynamic";

export default async function CreateUnitPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in?next=/add");
  }

  return (
    <div className="bg-background min-h-dvh w-full">
      <div className="mx-auto flex max-w-2xl flex-col px-4 py-6 md:px-6 md:py-10">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 self-start text-sm transition"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to home
        </Link>
        <header className="mb-6">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Create unit
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            A minute of setup. Live the moment you save.
          </p>
        </header>
        <CreateUnitForm />
      </div>
    </div>
  );
}
