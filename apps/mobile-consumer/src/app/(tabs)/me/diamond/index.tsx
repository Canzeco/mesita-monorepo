import { useRouter } from 'expo-router';
import { DiamondModal } from '@/components/me/DiamondModal';

// /me/diamond — invited or not (MESITA-2040). Was /me/class, a four-rung
// ladder with three doors under it.
export default function DiamondPage() {
  const router = useRouter();
  return <DiamondModal visible asRoute onClose={() => router.back()} />;
}
