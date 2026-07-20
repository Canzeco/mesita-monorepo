import type { LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

import type { StatusMeta } from '@/components/coupon/coupon-status';

const BANNER_TONE: Record<
  NonNullable<StatusMeta['banner']>['tone'],
  string
> = {
  info: 'border-sky-400/30 bg-sky-50',
  warn: 'border-amber-400/30 bg-amber-50',
  error: 'border-destructive/30 bg-destructive/10',
  muted: 'border-border bg-muted',
};

const BANNER_TEXT: Record<
  NonNullable<StatusMeta['banner']>['tone'],
  string
> = {
  info: 'text-sky-900',
  warn: 'text-amber-900',
  error: 'text-destructive',
  muted: 'text-muted-foreground',
};

export function StatusBanner({
  banner,
}: {
  banner: NonNullable<StatusMeta['banner']>;
}) {
  return (
    <View className={`rounded-2xl border px-3 py-2.5 ${BANNER_TONE[banner.tone]}`}>
      <Text className={`text-[12.5px] leading-snug ${BANNER_TEXT[banner.tone]}`}>
        {banner.text}
      </Text>
    </View>
  );
}

export function MetaRow({
  Icon,
  label,
  value,
  iconColor = '#775254',
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  iconColor?: string;
}) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <Icon color={iconColor} size={16} strokeWidth={2} />
      <Text className="flex-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}
