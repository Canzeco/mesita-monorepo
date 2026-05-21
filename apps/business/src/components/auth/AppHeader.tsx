import Link from "next/link";
import { ChevronDown, LogOut, MapPin } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authSignOut } from "@/app/auth/actions";

// Slim top bar used on the non-dashboard authenticated surfaces
// (/, /onboard, /add). Brand on the left links back to home; account
// menu on the right surfaces the user's email, jump-to-venue links,
// and a sign-out action. Replaces the ad-hoc "Back to home" link +
// "Signed in as foo@bar" chip we used to scatter across these pages.

export type HeaderVenue = {
  id: string;
  name: string;
};

export function AppHeader({
  email,
  venues,
}: {
  email: string | null;
  // Pre-fetched on the server. Empty for first-time users — the menu
  // adapts ("You haven't added any venues yet") instead of hiding.
  venues: HeaderVenue[];
}) {
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 md:px-10">
        <Brandmark />
        <AccountMenu email={email} venues={venues} />
      </div>
    </header>
  );
}

function Brandmark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 no-underline">
      <span className="bg-peacock shadow-glow flex h-8 w-8 items-center justify-center rounded-full text-[15px]">
        🦚
      </span>
      <span className="font-display text-[19px] font-semibold tracking-[-0.02em]">
        mesita.
      </span>
    </Link>
  );
}

function AccountMenu({
  email,
  venues,
}: {
  email: string | null;
  venues: HeaderVenue[];
}) {
  const initial = (email?.[0] ?? "?").toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="border-border bg-card hover:bg-muted inline-flex items-center gap-2 rounded-full border py-1.5 pr-3 pl-1.5 text-sm font-medium transition">
        <span className="bg-peacock flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold text-white">
          {initial}
        </span>
        <span className="text-foreground hidden max-w-[180px] truncate sm:inline">
          {email ?? "Signed in"}
        </span>
        <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
            Signed in as
          </span>
          <span className="truncate text-sm">{email ?? "(no email)"}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {venues.length > 0 ? (
          <>
            <DropdownMenuLabel className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
              Your venues
            </DropdownMenuLabel>
            {venues.map((v) => (
              <DropdownMenuItem key={v.id} asChild>
                <Link
                  href={`/unit/${v.id}/home`}
                  className="cursor-pointer truncate"
                >
                  <MapPin className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="truncate">{v.name}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        ) : (
          <p className="text-muted-foreground px-2 py-1.5 text-[12px] leading-relaxed">
            You haven&apos;t added any venues yet.
          </p>
        )}
        <DropdownMenuSeparator />
        <form action={authSignOut.bind(null, "/")} className="contents">
          <button
            type="submit"
            className="text-foreground hover:bg-muted relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
