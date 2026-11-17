// ANONYMOUS_BROWSE (MESITA-4246): the kill switch. On unless the server env
// says `off`; read at call time, so a Vercel env change takes effect on the
// next deploy. Off puts back the whole sign-in wall; /sign keeps working.
export function anonymousBrowseOn(): boolean {
  return (process.env.ANONYMOUS_BROWSE ?? "").trim().toLowerCase() !== "off";
}
