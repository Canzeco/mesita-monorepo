import { SearchClient } from '@/components/search/SearchClient';

// Search = map + catalog suggest + add-place. Map uses Google provider when
// EXPO_PUBLIC_GMP_KEY is set (native); web export and missing keys degrade to
// a branded placeholder — suggest/rail/add still work (EF-backed).
export default function SearchScreen() {
  return <SearchClient />;
}
