import { useRouter } from 'expo-router';
import { DiamondModal } from '@/components/me/DiamondModal';

// /me/diamond — the Diamond page: Diamond or not (MESITA-2044, MESITA-2046). Was
// /me/class, a four-rung ladder with three doors under it.
export default function DiamondPage() {
  const router = useRouter();
  return <DiamondModal visible asRoute onClose={() => router.back()} />;
}
