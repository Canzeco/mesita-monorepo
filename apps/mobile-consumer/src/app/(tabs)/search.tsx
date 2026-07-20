import { SearchClient } from '@/components/search/SearchClient';
import { ShellWash } from '@/components/ui/HeroBackdrop';

// Search = map + catalog suggest + add-place. Soft shell wash peeks at
// edges / loading (web shell bg); map fills the plane when tiles load.
export default function SearchScreen() {
  return (
    <ShellWash>
      <SearchClient />
    </ShellWash>
  );
}
