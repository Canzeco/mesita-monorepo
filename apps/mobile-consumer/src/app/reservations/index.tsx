import { Redirect } from "expo-router";

/** The list lives on the Bookings tab (MESITA-5057); old links land there. */
export default function Route() {
  return <Redirect href="/bookings" />;
}
