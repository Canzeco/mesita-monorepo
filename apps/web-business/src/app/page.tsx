import { redirect } from "next/navigation";

/** The console opens on Visits: the one page staff use every day. */
export default function Home() {
  redirect("/visits");
}
