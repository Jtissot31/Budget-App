import { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { planFinanceKit } from '@/constants/planFinanceKit';
import { spacing, typographyKit } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  eyebrow: string;
  title: string;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Soft `#4ADE80` eyebrow — hub strategy / épargne only; keep Obligations muted. */
  accentEyebrow?: boolean;
};

/** One eyebrow + one section title — no lead paragraph; parent owns vertical rhythm via `gap`. */
export function HubSectionHeader({ eyebrow, title, trailing, style, accentEyebrow = false }: Props) {
  const { colors } = useAppTheme();
  const eyebrowColor = accentEyebrow ? colors.accentGreen || colors.primary : undefined;

  return (
    <View style={[styles.header, style]}>
      <View style={styles.titleGroup}>
        <DashboardSectionLabel style={eyebrowColor ? { color: eyebrowColor } : undefined}>
          {eyebrow}
        </DashboardSectionLabel>
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
    paddingBottom: spacing.xs,
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    ...typographyKit.sectionTitle,
    letterSpacing: -0.5,
  },
  trailing: {
    flexShrink: 0,
    paddingTop: 2,
  },
});

/** Hub section vertical gap — aligns with planFinanceKit.layout.blockGap. */
export const HUB_SECTION_INNER_GAP = planFinanceKit.layout.blockGap;
