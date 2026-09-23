import { useRouter } from 'expo-router';
import { DiamondModal } from '@/components/me/DiamondModal';

// /me/diamond — the Diamond List page: on it or not (MESITA-2044). Was
// /me/class, a four-rung ladder with three doors under it.
export default function DiamondPage() {
  const router = useRouter();
  return <DiamondModal visible asRoute onClose={() => router.back()} />;
}
