import { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { spacing, typographyKit } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  eyebrow: string;
  title: string;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function HubSectionHeader({ eyebrow, title, trailing, style }: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.header, style]}>
      <View style={styles.titleGroup}>
        <DashboardSectionLabel>{eyebrow}</DashboardSectionLabel>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    ...typographyKit.sectionTitle,
  },
  trailing: {
    flexShrink: 0,
  },
});
