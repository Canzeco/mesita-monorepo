import { useRouter } from 'expo-router';
import { VerifySocialSheet } from '@/components/me/VerifySocialSheet';

export default function InstagramPage() {
  const router = useRouter();
  return (
    <VerifySocialSheet visible asRoute onClose={() => router.back()} />
  );
}
