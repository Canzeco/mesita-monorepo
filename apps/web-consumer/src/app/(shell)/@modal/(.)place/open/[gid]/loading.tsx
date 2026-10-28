import { GeneratingPlaceScreen } from "@/components/consumer/GeneratingPlace";

// Renders INSIDE the SlideOverShell mounted by ../../layout.tsx: the
// generating view OpeningGooglePlace draws while the profile is created
// (MESITA-2935), so the open lands in one step.
export default function OpeningGooglePlaceModalLoading() {
  return <GeneratingPlaceScreen variant="modal" />;
}
