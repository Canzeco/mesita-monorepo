import { redirect } from "next/navigation";

// /pay/pick — old address of Pay Bill's place picker. The picker is a sheet
// on /pay (MESITA-4478). The route file stays so the route map still finds it.
export default function Page() {
  redirect("/pay?pick=1");
}
