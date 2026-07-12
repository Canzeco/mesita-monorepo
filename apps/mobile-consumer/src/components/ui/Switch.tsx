import { Root, Thumb } from '@rn-primitives/switch';
import { View } from 'react-native';

// Styled @rn-primitives/switch — replaces react-native-paper Switch.
// Outer hit target ≥44px; visible track stays compact.
export function Switch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <View className="min-h-[44px] min-w-[44px] items-center justify-center">
      <Root
        checked={value}
        onCheckedChange={onValueChange}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
        className={
          value
            ? 'h-7 w-12 justify-center rounded-full bg-primary px-0.5'
            : 'h-7 w-12 justify-center rounded-full bg-muted px-0.5'
        }
      >
        <Thumb
          className="h-6 w-6 rounded-full bg-card"
          style={{
            alignSelf: value ? 'flex-end' : 'flex-start',
          }}
        />
      </Root>
    </View>
  );
}
