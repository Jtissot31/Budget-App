import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { SurfaceCard } from '@/components/SurfaceCard';
import { SETTINGS_LAYOUT } from '@/constants/theme';

type Props = {
  title: string;
  children: ReactNode;
  style?: ViewStyle;
};

/** Grouped settings block — eyebrow header + card shell. */
export function SettingsSection({ title, children, style }: Props) {
  return (
    <View style={[styles.section, style]}>
      <DashboardSectionLabel numberOfLines={1}>{title}</DashboardSectionLabel>
      <SurfaceCard padding={0} style={styles.card} innerStyle={styles.cardInner}>
        {children}
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: SETTINGS_LAYOUT.sectionLabelGap,
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  card: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  cardInner: {
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
});
