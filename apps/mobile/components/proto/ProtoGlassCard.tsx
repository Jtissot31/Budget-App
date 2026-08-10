/**
 * Budget Proto glass card shell — 18px radius, hairline optional.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { RADIUS } from '@/constants/design-tokens';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
};

export function ProtoGlassCard({ children, style, padding = 0 }: Props) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.containerBackground,
          borderColor: colors.containerBorder,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.onyx,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
