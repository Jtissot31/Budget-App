import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SurfaceCard } from '@/components/SurfaceCard';
import {
  detailSectionFootnoteStyle,
  detailSectionLabelStyle,
  detailSectionsCardStyle,
  detailSingleLineRowStyle,
  detailSubSectionHeaderStyle,
  detailSubSectionsGap,
  spacing,
  typographyKit,
  type AppColors,
} from '@/constants/theme';
import {
  detailRowLabel,
  detailRowValueSlot,
  detailRowValueTextProps,
  rowValue,
  singleLineAmountProps,
} from '@/lib/textLayout';

export type DetailSectionRow = {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  valueColor?: string;
  /** `amount` keeps the compact right column for money; default `text` lets values grow. */
  valueLayout?: 'amount' | 'text';
  valueContent?: ReactNode;
};

export type DetailSection = {
  title: string;
  rows: DetailSectionRow[];
};

type DetailColors = Pick<AppColors, 'text' | 'textMuted' | 'border'>;

export { detailSectionLabelStyle } from '@/constants/theme';

export function DetailSectionsCard({
  sections,
  colors,
  footnote,
  label = 'DÉTAILS',
  style,
  padding,
  rowPaddingVertical,
  subSectionHeaderGap,
}: {
  sections: DetailSection[];
  colors: DetailColors;
  footnote?: string | null;
  label?: string;
  style?: ViewStyle;
  padding?: number;
  rowPaddingVertical?: number;
  subSectionHeaderGap?: number;
}) {
  return (
    <SurfaceCard style={[detailSectionsCardStyle(), style]} padding={padding}>
      <Text style={[detailSectionLabelStyle(), { color: colors.textMuted }]}>{label}</Text>
      <DetailSectionsList
        sections={sections}
        colors={colors}
        footnote={footnote}
        rowPaddingVertical={rowPaddingVertical}
        subSectionHeaderGap={subSectionHeaderGap}
      />
    </SurfaceCard>
  );
}

export function DetailSectionsList({
  sections,
  colors,
  footnote,
  rowPaddingVertical,
  subSectionHeaderGap,
}: {
  sections: DetailSection[];
  colors: DetailColors;
  footnote?: string | null;
  rowPaddingVertical?: number;
  subSectionHeaderGap?: number;
}) {
  const visibleSections = useMemo(
    () => sections.filter((section) => section.rows.length > 0),
    [sections],
  );

  if (visibleSections.length === 0 && !footnote) return null;

  return (
    <View>
      {visibleSections.map((section, sectionIndex) => (
        <DetailSubSection
          key={section.title}
          section={section}
          colors={colors}
          showTopBorder={sectionIndex === 0}
          style={sectionIndex > 0 ? styles.sectionGap : undefined}
          rowPaddingVertical={rowPaddingVertical}
          subSectionHeaderGap={subSectionHeaderGap}
        />
      ))}
      {footnote ? (
        <Text style={[detailSectionFootnoteStyle(), { color: colors.textMuted }]}>{footnote}</Text>
      ) : null}
    </View>
  );
}

export function DetailSubSection({
  section,
  colors,
  showTopBorder = true,
  style,
  rowPaddingVertical,
  subSectionHeaderGap,
}: {
  section: DetailSection;
  colors: DetailColors;
  showTopBorder?: boolean;
  style?: object;
  rowPaddingVertical?: number;
  subSectionHeaderGap?: number;
}) {
  if (section.rows.length === 0) return null;

  return (
    <View style={style}>
      <Text
        style={[
          detailSubSectionHeaderStyle(),
          subSectionHeaderGap != null && { marginBottom: subSectionHeaderGap },
          { color: colors.textMuted },
        ]}
      >
        {section.title}
      </Text>
      <View
        style={[
          styles.rows,
          showTopBorder && { borderTopColor: colors.border },
        ]}
      >
        {section.rows.map((row, rowIndex) => (
          <DetailSingleLineRow
            key={row.label}
            row={row}
            colors={colors}
            isLast={rowIndex === section.rows.length - 1}
            rowPaddingVertical={rowPaddingVertical}
          />
        ))}
      </View>
    </View>
  );
}

export function DetailSingleLineRow({
  row,
  colors,
  isLast,
  rowPaddingVertical,
}: {
  row: DetailSectionRow;
  colors: DetailColors;
  isLast: boolean;
  rowPaddingVertical?: number;
}) {
  return (
    <View
      style={[
        detailSingleLineRowStyle(),
        row.valueLayout === 'amount' && styles.amountRow,
        rowPaddingVertical != null && { paddingVertical: rowPaddingVertical },
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      {row.icon ? (
        <Ionicons
          name={row.icon}
          size={17}
          color={colors.textMuted}
          style={[styles.rowIcon, row.valueLayout === 'amount' && styles.amountRowIcon]}
        />
      ) : (
        <View style={styles.rowIconSpacer} />
      )}
      <Text
        style={[styles.rowLabel, detailRowLabel, { color: colors.textMuted }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {row.label}
      </Text>
      {row.valueContent ? (
        <View style={styles.rowValueSlot}>{row.valueContent}</View>
      ) : (
        <View style={styles.rowValueSlot}>
          <Text
            style={[
              styles.rowValue,
              rowValue,
              { color: row.valueColor ?? colors.text },
            ]}
            {...(row.valueLayout === 'amount' ? singleLineAmountProps : detailRowValueTextProps)}
          >
            {row.value}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionGap: {
    marginTop: detailSubSectionsGap,
  },
  rows: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  amountRow: {
    alignItems: 'center',
  },
  rowIcon: {
    width: 18,
    marginTop: 1,
  },
  amountRowIcon: {
    marginTop: 0,
  },
  rowIconSpacer: {
    width: 18,
  },
  rowLabel: {
    ...typographyKit.metaMedium,
    marginRight: spacing.sm,
  },
  rowValue: {
    textAlign: 'right',
  },
  rowValueSlot: {
    ...detailRowValueSlot,
  },
});
