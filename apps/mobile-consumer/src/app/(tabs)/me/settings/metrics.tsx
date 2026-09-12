import { useRouter } from 'expo-router';
import { MetricsModal } from '@/components/me/MetricsModal';

export default function MetricsPage() {
  const router = useRouter();
  return <MetricsModal visible asRoute onClose={() => router.back()} />;
}
