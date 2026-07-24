import { ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { typographyKit } from '@/constants/typographyKit';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

/** Uppercase section eyebrow label — matches dashboard tab styling. */
export function DashboardSectionLabel({ children, style, numberOfLines }: Props) {
  const { colors } = useAppTheme();
  return (
    <Text
      style={[styles.label, { color: colors.textMuted }, style]}
      {...(numberOfLines != null ? { numberOfLines, ellipsizeMode: 'tail' as const } : {})}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typographyKit.eyebrow,
  },
});
