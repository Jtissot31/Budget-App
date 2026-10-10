/**
 * Budget-OX UI kit — primitives extracted from the Transactions history screens.
 *
 * Every hub/detail screen composes these so the app reads as one system:
 * - `PageHeader`     large title (+ optional subtitle / trailing icon buttons)
 * - `ListCard`       one glass card grouping many rows (hairline separators)
 * - `ListRow`        40px icon well · title/subtitle · right-aligned value
 * - `IconWell`       the 40px rounded square behind row glyphs
 * - `SummaryCard`    KPI card (label · hero amount · chart slot · stats)
 * - `SectionLabel`   uppercase muted eyebrow (re-export of ProtoSectionHeader)
 * - `EmptyRow`       muted single-line placeholder inside a ListCard
 *
 * Text never crops: titles and amounts go through `FitText`, which shrinks to the
 * available width on every screen size (see FitText.tsx).
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppIcon } from '@/components/icons/AppIcon';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  jakartaMediumText,
  jakartaSemiboldText,
  moneyAmountTypography,
  PAGE_TITLE_CONTENT_GAP,
  PAGE_TITLE_STYLE,
  spacing,
  transactionRowAmountTypography,
  typographyKit,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { FitText } from './FitText';
import { AnimatedBar, PressScale, Reveal, useCountUp } from './motion';

export { ProtoGlassCard as ListCard } from '@/components/proto/ProtoGlassCard';
export { ProtoSectionHeader as SectionLabel } from '@/components/proto/ProtoSectionHeader';
export { ProtoToolbarIconButton as HeaderIconButton } from '@/components/proto/ProtoSearchToolbar';
export { FitText, useScreenScale } from './FitText';
export { GoalTile } from './GoalTile';
export { PillButton } from './PillButton';
export { AnimatedBar, PressScale, Reveal, useCountUp } from './motion';
export {
  AreaSparkline,
  CHART_PALETTE,
  monoShade,
  RingGauge,
  SplitBar,
  SUBTLE_ACCENTS,
  withAlpha,
  type SplitSegment,
} from './charts';

type IoniconName = keyof typeof Ionicons.glyphMap;

export const ROW_ICON_WELL = 40;
const ROW_PAD_H = 14;
const ROW_GAP = 12;
/** Left edge of row copy — progress bars / sub-content align here. */
export const ROW_TEXT_INSET = ROW_PAD_H + ROW_ICON_WELL + ROW_GAP;

/* ───────────────────────── PageHeader ───────────────────────── */

type PageHeaderProps = {
  title: string;
  topInset: number;
  /** Small muted line under the title (e.g. « Octobre 2026 »). */
  subtitle?: string;
  trailing?: ReactNode;
};

/** Same metrics as `TransactionsViewHeader`. Parent owns horizontal padding. */
export function PageHeader({ title, topInset, subtitle, trailing }: PageHeaderProps) {
  const { colors } = useAppTheme();
  return (
    <View style={{ paddingTop: topInset + SCREEN_TOP_GUTTER }}>
      <View style={[styles.headerBar, { marginBottom: PAGE_TITLE_CONTENT_GAP }]}>
        <View style={styles.headerCopy}>
          <FitText
            style={[PAGE_TITLE_STYLE, styles.pageTitle, { color: colors.text }]}
            fontSize={PAGE_TITLE_STYLE.fontSize ?? 32}
            lineHeight={40}
            minScale={0.7}
            responsive
          >
            {title}
          </FitText>
          {subtitle ? (
            <FitText
              style={[styles.pageSubtitle, { color: colors.textMuted }]}
              fontSize={13}
              lineHeight={17}
              minScale={0.85}
            >
              {subtitle}
            </FitText>
          ) : null}
        </View>
        {trailing ? <View style={styles.headerTrailing}>{trailing}</View> : null}
      </View>
    </View>
  );
}

/* ───────────────────────── IconWell ───────────────────────── */

type IconWellProps = {
  icon?: IoniconName;
  color?: string;
  /** Tinted background (e.g. category color at low alpha). Defaults to surfaceElevated. */
  background?: string;
  size?: number;
  children?: ReactNode;
};

export function IconWell({ icon, color, background, size = ROW_ICON_WELL, children }: IconWellProps) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.iconWell,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.3),
          backgroundColor: background ?? colors.surfaceElevated,
        },
      ]}
    >
      {children ??
        (icon ? (
          <AppIcon
            family="ionicons"
            name={icon}
            size={Math.round(size * 0.5)}
            color={color ?? colors.textMuted}
          />
        ) : null)}
    </View>
  );
}

/** Calendar-style well: short month over day number (bills, échéances). */
export function DateWell({ month, day }: { month: string; day: string | number }) {
  const { colors } = useAppTheme();
  return (
    <IconWell>
      <Text style={[styles.dateMonth, { color: colors.textMuted }]}>{month}</Text>
      <Text style={[styles.dateDay, { color: colors.text }]}>{day}</Text>
    </IconWell>
  );
}

/* ───────────────────────── ListRow ───────────────────────── */

type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Override the muted subtitle colour (e.g. amber for « Demain »). */
  subtitleColor?: string;
  leading?: ReactNode;
  /** Right column, primary line (money uses transaction-row amount face). */
  value?: string;
  valueColor?: string;
  /** Right column, small muted second line. */
  valueSub?: string;
  valueSubColor?: string;
  /** 0..1 — thin animated bar under the copy, aligned with the title. */
  progress?: number;
  progressColor?: string;
  chevron?: boolean;
  /** Custom trailing node — replaces value/valueSub. */
  trailing?: ReactNode;
  isLast?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function ListRow({
  title,
  subtitle,
  subtitleColor,
  leading,
  value,
  valueColor,
  valueSub,
  valueSubColor,
  progress,
  progressColor,
  chevron = false,
  trailing,
  isLast = false,
  onPress,
  accessibilityLabel,
}: ListRowProps) {
  const { colors } = useAppTheme();

  const body = (
    <>
      <View style={styles.row}>
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <View style={styles.copy}>
          <FitText
            style={[styles.rowTitle, jakartaSemiboldText, { color: colors.text }]}
            fontSize={15}
            lineHeight={20}
            minScale={0.82}
          >
            {title}
          </FitText>
          {subtitle ? (
            <FitText
              style={[styles.rowSubtitle, jakartaMediumText, { color: subtitleColor ?? colors.textMuted }]}
              fontSize={12.5}
              lineHeight={16}
              minScale={0.72}
            >
              {subtitle}
            </FitText>
          ) : null}
        </View>
        {trailing ?? (
          value != null || valueSub != null ? (
            <View style={styles.valueCol}>
              {value != null ? (
                <Text
                  style={[
                    transactionRowAmountTypography({ fontSize: 15, lineHeight: 20 }),
                    { color: valueColor ?? colors.text, letterSpacing: -0.3 },
                  ]}
                  numberOfLines={1}
                >
                  {value}
                </Text>
              ) : null}
              {valueSub ? (
                <Text
                  style={[styles.rowSubtitle, jakartaMediumText, { color: valueSubColor ?? colors.textMuted }]}
                  numberOfLines={1}
                >
                  {valueSub}
                </Text>
              ) : null}
            </View>
          ) : null
        )}
        {chevron ? (
          <AppIcon
            family="ionicons"
            name="chevron-forward"
            size={16}
            color={colors.textMuted}
            style={styles.chevron}
          />
        ) : null}
      </View>
      {progress != null ? (
        <AnimatedBar
          progress={progress}
          color={progressColor ?? colors.accentGreen}
          trackColor={colors.borderSubtle}
          style={[styles.progress, { marginLeft: leading ? ROW_TEXT_INSET : ROW_PAD_H }]}
        />
      ) : null}
    </>
  );

  const separator = !isLast && {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.containerBorder,
  };

  if (!onPress) {
    return (
      <View style={[styles.hit, separator]} accessibilityLabel={accessibilityLabel}>
        {body}
      </View>
    );
  }
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (value ? `${title}, ${value}` : title)}
      scaleTo={0.98}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={[styles.hit, separator]}
    >
      {body}
    </PressScale>
  );
}

/** Muted placeholder line inside a ListCard. */
export function EmptyRow({ label, actionLabel, onAction }: { label: string; actionLabel?: string; onAction?: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.emptyRow}>
      <Text style={[styles.rowSubtitle, jakartaMediumText, { color: colors.textMuted, flexShrink: 1, flexGrow: 1 }]}>
        {label}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            tapHaptic();
            onAction();
          }}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={[typographyKit.metaSemibold, { color: colors.text }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ───────────────────────── SummaryCard ───────────────────────── */

export type SummaryStat = { label: string; value: string; color?: string };

type SummaryCardProps = {
  label: string;
  amount: string;
  amountColor?: string;
  /**
   * Raw number behind `amount` — when set with `formatAmount`, the hero eases
   * (count-up) whenever the value changes.
   */
  amountValue?: number;
  formatAmount?: (value: number) => string;
  /** Small coloured text to the right of the label (e.g. trend « +2,3 % »). */
  badge?: { label: string; color: string };
  footer?: string;
  stats?: SummaryStat[];
  /** Chart / visual slot under the hero amount. */
  children?: ReactNode;
  /** Visual placed to the right of the hero amount (ring gauge…). */
  aside?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

function SummaryAmount({
  amount,
  amountValue,
  formatAmount,
  color,
}: {
  amount: string;
  amountValue?: number;
  formatAmount?: (value: number) => string;
  color: string;
}) {
  const animated = useCountUp(amountValue ?? 0);
  const text = amountValue != null && formatAmount ? formatAmount(animated) : amount;
  return (
    <FitText
      style={[moneyAmountTypography({ tier: 'stat', fontSize: 28 }), { color, letterSpacing: -0.8 }]}
      fontSize={28}
      lineHeight={34}
      minScale={0.55}
      responsive
      accessibilityLabel={amount}
    >
      {text}
    </FitText>
  );
}

/** Same shell as `SpendAndSaveCard`, with a larger hero amount and a chart slot. */
export function SummaryCard({
  label,
  amount,
  amountColor,
  amountValue,
  formatAmount,
  badge,
  footer,
  stats,
  children,
  aside,
  onPress,
  accessibilityLabel,
  style,
}: SummaryCardProps) {
  const { colors } = useAppTheme();
  const card = (
    <ProtoGlassCard padding={16} style={[styles.summaryCard, style]}>
      <View style={styles.summaryTop}>
        <View style={styles.summaryHero}>
          <View style={styles.summaryLabelRow}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]} numberOfLines={1}>
              {label}
            </Text>
            {badge && !aside ? (
              <Text style={[styles.summaryBadge, { color: badge.color }]} numberOfLines={1}>
                {badge.label}
              </Text>
            ) : null}
          </View>
          <SummaryAmount
            amount={amount}
            amountValue={amountValue}
            formatAmount={formatAmount}
            color={amountColor ?? colors.text}
          />
          {badge && aside ? (
            <Text style={[styles.summaryBadge, { color: badge.color }]} numberOfLines={1}>
              {badge.label}
            </Text>
          ) : null}
        </View>
        {aside}
      </View>
      {children}
      {stats && stats.length > 0 ? (
        <View style={[styles.statRow, { borderTopColor: colors.borderSubtle }]}>
          {stats.map((stat, index) => (
            <View
              key={stat.label}
              style={[
                styles.statCell,
                index > 0 && {
                  borderLeftWidth: StyleSheet.hairlineWidth,
                  borderLeftColor: colors.borderSubtle,
                  paddingLeft: spacing.md,
                },
              ]}
            >
              <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>
                {stat.label}
              </Text>
              <FitText
                style={[
                  transactionRowAmountTypography({ fontSize: 15, lineHeight: 20 }),
                  { color: stat.color ?? colors.text, letterSpacing: -0.3 },
                ]}
                fontSize={15}
                lineHeight={20}
                minScale={0.6}
              >
                {stat.value}
              </FitText>
            </View>
          ))}
        </View>
      ) : null}
      {footer ? (
        <Text style={[styles.summaryFooter, { color: colors.textMuted }]} numberOfLines={2}>
          {footer}
        </Text>
      ) : null}
    </ProtoGlassCard>
  );
  if (!onPress) return <Reveal>{card}</Reveal>;
  return (
    <Reveal>
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label}, ${amount}`}
      scaleTo={0.985}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={{ width: '100%' }}
    >
      {card}
    </PressScale>
    </Reveal>
  );
}

/** Vertical rhythm between page sections (matches Transactions day groups). */
export const SECTION_GAP = spacing.lg;

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTrailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pageTitle: { paddingVertical: 2 },
  pageSubtitle: { ...typographyKit.metaMedium, marginTop: 2 },
  iconWell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dateMonth: {
    ...jakartaMediumText,
    fontSize: 9,
    lineHeight: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dateDay: {
    ...jakartaSemiboldText,
    fontSize: 15,
    lineHeight: 18,
  },
  hit: { alignSelf: 'stretch', width: '100%' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: ROW_PAD_H,
    paddingVertical: 12,
    minHeight: 64,
  },
  leading: { marginRight: ROW_GAP, flexShrink: 0 },
  copy: { flex: 1, minWidth: 0, justifyContent: 'center', marginRight: ROW_GAP },
  rowTitle: { letterSpacing: -0.2 },
  rowSubtitle: { fontSize: 12.5, lineHeight: 16, marginTop: 2 },
  valueCol: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '45%' },
  chevron: { marginLeft: spacing.xs },
  progress: { marginRight: ROW_PAD_H, marginTop: -4, marginBottom: 12 },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ROW_PAD_H,
    paddingVertical: 18,
    gap: spacing.sm,
  },
  summaryCard: { gap: 12 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  summaryHero: { flex: 1, minWidth: 0, gap: 4 },
  summaryLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  summaryLabel: { ...typographyKit.metaMedium, fontSize: 12, letterSpacing: -0.1, flexShrink: 1 },
  summaryBadge: { ...typographyKit.metaSemibold, fontSize: 12 },
  summaryFooter: { ...typographyKit.metaMedium, fontSize: 11.5, letterSpacing: -0.1 },
  statRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  statCell: { flex: 1, minWidth: 0, gap: 3 },
  statLabel: { ...typographyKit.metaMedium, fontSize: 11 },
  pressed: { opacity: 0.78 },
});
