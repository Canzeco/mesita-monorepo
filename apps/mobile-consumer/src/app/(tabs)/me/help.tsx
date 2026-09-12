import { useRouter } from 'expo-router';
import { HelpModal } from '@/components/me/HelpModal';

export default function HelpPage() {
  const router = useRouter();
  return <HelpModal visible asRoute onClose={() => router.back()} />;
}
