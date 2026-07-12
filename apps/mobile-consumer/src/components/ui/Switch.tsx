import { Root, Thumb } from '@rn-primitives/switch';

// Styled @rn-primitives/switch — replaces react-native-paper Switch.
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
    <Root
      checked={value}
      onCheckedChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
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
  );
}
