import type { LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

export function MetaRow({
  Icon,
  iconColor = '#775254',
  label,
  value,
}: {
  Icon: LucideIcon;
  iconColor?: string;
  label: string;
  value: string;
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
