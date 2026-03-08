import { View, type ViewProps, type DimensionValue } from 'react-native';

interface SeparatorProps extends ViewProps {
  color?: string;
  lineWidth?: DimensionValue;
}

export default function Separator({ color = 'gray', lineWidth = 2, ...props }: SeparatorProps) {
  return (
    <View
      style={{
        backgroundColor: color,
        height: lineWidth,
      }}
      {...props}
    />
  );
}
