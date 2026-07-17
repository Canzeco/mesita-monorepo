import { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { type LucideIcon } from 'lucide-react-native';

export function Box({
  title,
  icon: Icon,
  iconColor = '#775254',
  right,
  children,
  bare = false,
}: {
  title?: string;
  icon?: LucideIcon;
  iconColor?: string;
  right?: ReactNode;
  children: ReactNode;
  bare?: boolean;
}) {
  return (
    <View
      className={`rounded-2xl border border-border bg-card ${
        bare ? 'overflow-hidden' : 'gap-3 p-4'
      }`}
    >
      {(title || Icon) && !bare ? (
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-2">
            {Icon ? <Icon color={iconColor} size={16} strokeWidth={1.75} /> : null}
            {title ? <BoxLabel>{title}</BoxLabel> : null}
          </View>
          {right ? (
            <Text className="shrink text-right text-xs font-medium text-muted-foreground">
              {right}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function BoxLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
      {children}
    </Text>
  );
}
