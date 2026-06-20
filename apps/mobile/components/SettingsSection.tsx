import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { SurfaceCard } from '@/components/SurfaceCard';
import { spacing } from '@/constants/theme';

type Props = {
  title: string;
  children: ReactNode;
  style?: ViewStyle;
};

/** Grouped settings block — eyebrow header + card shell. */
export function SettingsSection({ title, children, style }: Props) {
  return (
    <View style={[styles.section, style]}>
      <DashboardSectionLabel>{title}</DashboardSectionLabel>
      <SurfaceCard padding={0} innerStyle={styles.cardInner}>
        {children}
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  cardInner: {
    overflow: 'hidden',
  },
});
