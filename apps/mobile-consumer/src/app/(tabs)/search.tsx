import { SearchClient } from "@/components/search/SearchClient";
import { ShellWash } from "@/components/ui/HeroBackdrop";
import { SafeAreaView } from "react-native-safe-area-context";

// Visit › Search (MESITA-2050) — the map, under Visit's rail. The rail band
// owns the top safe area, so SearchClient's floating bar sits 8pt below the
// rail instead of below the status bar.
export default function SearchScreen() {
  return (
    <ShellWash>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <SearchClient topInset={0} />
      </SafeAreaView>
    </ShellWash>
  );
}
