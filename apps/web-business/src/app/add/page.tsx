import { redirect } from "next/navigation";

// /add is closed (MESITA-1664). Businesses no longer put places into the
// catalogue — admin does, through Manage Multiple — so the search-and-create
// flow this route hosted has no caller. Pato, 2026-09-08: "for the moment
// don't enable managers to add places from the business app... businesses can
// only claim/verify them and own them."
//
// A REDIRECT, NOT A DELETE, and not a 404. Two reasons. Operators have this
// URL in tabs and bookmarks, and dead-ending them on a page that used to work
// teaches nothing; /places is where the answer now lives. And the flow's seven
// component files stay on disk for the moment because four of them are held
// uncommitted by MESITA-1590's rename sweep — removing them under that session
// turns its merge into delete-modify conflicts. They are unreachable from here
// and come out in a follow-up once that lands.
export default function ClosedAddPlacePage() {
  redirect("/places");
}
