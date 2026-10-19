/**
 * Accueil — sections du bas, plus visuelles :
 * - NextPayments : le prochain paiement en vedette + les suivants en carrousel.
 * - SpendingSnapshot : où va l'argent ce mois (top catégories).
 * - GoalsOverview : progression globale de l'épargne au-dessus de la grille d'objectifs.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PayIcon } from '@/components/agenda/ProtoAgendaScreen';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { AppIcon } from '@/components/icons/AppIcon';
import { AnimatedBar, FitText, ListCard, PressScale, RingGauge, withAlpha } from '@/components/kit';
import {
  jakartaMediumText,
  jakartaSemiboldText,
  moneyAmountTypography,
  PAGE_PADDING_HORIZONTAL,
  typographyKit,
} from '@/constants/theme';
import type { BudgetCategoryUiModel } from '@/lib/budgetCategoryModel';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type { AgendaBill } from '@/types';

const AMBER = '#F59E0B';
const CAROUSEL_MAX = 3;
/** Low-balance warnings cover the next payment and anything due up to this many days after it. */
const WARN_WINDOW_DAYS = 3;
const CARD_WIDTH = 136;
const TOP_CATEGORIES = 4;
/** Monochrome steps for « Où va ton argent » — biggest category brightest, no bright hues. */
const MONO_TONES_DARK = ['#D4D4D8', '#A1A1AA', '#71717A', '#52525B'];
const MONO_TONES_LIGHT = ['#27272A', '#52525B', '#A1A1AA', '#D4D4D8'];

export type UpcomingRow = { dateKey: string; bill: AgendaBill };

function daysUntil(dateKey: string, now = new Date()): number {
  const due = new Date(`${dateKey}T12:00:00`);
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  return Math.max(0, Math.round((due.getTime() - today.getTime()) / 86_400_000));
}

function countdownLabel(days: number): string {
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Demain';
  return `Dans ${days} j`;
}

function weekdayLabel(dateKey: string): string {
  const label = new Date(`${dateKey}T12:00:00`).toLocaleDateString('fr-CA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function open(action: () => void) {
  tapHaptic();
  action();
}

/* ───────────────────────── Prochain paiement ───────────────────────── */

export function NextPayments({
  rows,
  onOpen,
  shortfallFor,
}: {
  rows: readonly UpcomingRow[];
  /** Opens that payment in Agenda; no row → the Agenda itself. */
  onOpen: (row?: UpcomingRow) => void;
  /** Amount missing in the paying account for that row (0 = covered). */
  shortfallFor?: (row: UpcomingRow) => number;
}) {
  const { colors } = useAppTheme();
  const [next, ...rest] = rows;
  if (!next) return null;
  const nextDays = daysUntil(next.dateKey);
  const nextShortfall = shortfallFor?.(next) ?? 0;
  const accent = colors.text;
  // Featured payment (and any other due the same day) gets a soft dark fill — no outline.
  const featuredFill = colors.surfaceElevated;

  return (
    <View>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`Prochain paiement : ${next.bill.name}, ${formatDisplayMoneyAbsolute(next.bill.amount)}, ${countdownLabel(nextDays)}`}
        onPress={() => open(() => onOpen(next))}
      >
        <ListCard padding={16} style={{ backgroundColor: featuredFill, borderColor: featuredFill }}>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <PayIcon bill={next.bill} />
              <View style={styles.heroCopy}>
                <FitText
                  style={[styles.heroName, jakartaSemiboldText, { color: colors.text }]}
                  fontSize={16}
                  lineHeight={21}
                  minScale={0.7}
                >
                  {next.bill.name}
                </FitText>
                <FitText style={[styles.sub, jakartaMediumText, { color: colors.textMuted }]}>
                  {[weekdayLabel(next.dateKey), next.bill.account].filter(Boolean).join(' · ')}
                </FitText>
              </View>
            </View>
            <View style={styles.heroBottom}>
              <FitText
                style={[moneyAmountTypography({ tier: 'stat', fontSize: 28 }), styles.heroAmount, { color: colors.text }]}
                fontSize={28}
                lineHeight={34}
                minScale={0.6}
              >
                {`−${formatDisplayMoneyAbsolute(next.bill.amount)}`}
              </FitText>
              <View style={[styles.countdown, { backgroundColor: colors.background }]}>
                <AppIcon family="ionicons" name="time-outline" size={14} color={accent} />
                <Text style={[styles.countdownText, { color: accent }]}>
                  {countdownLabel(nextDays)}
                </Text>
              </View>
            </View>
            {nextShortfall > 0 ? (
              <View style={[styles.warning, { backgroundColor: withAlpha(AMBER, 0.12) }]}>
                <AppIcon family="ionicons" name="alert-circle-outline" size={15} color={AMBER} />
                <Text style={[styles.warningText, { color: AMBER }]} numberOfLines={1}>
                  {`Solde insuffisant · il manque ${formatDisplayMoneyAbsolute(nextShortfall)}`}
                </Text>
              </View>
            ) : null}
          </View>
        </ListCard>
      </PressScale>

      {rest.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.carousel}
          contentContainerStyle={styles.carouselContent}
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH + 10}
        >
          {rest.slice(0, CAROUSEL_MAX).map(({ dateKey, bill }) => {
            const days = daysUntil(dateKey);
            const sameDay = dateKey === next.dateKey;
            // Warn only for what's actually due soon: within 3 days of the featured payment.
            const nearNext = days - nextDays <= WARN_WINDOW_DAYS;
            const short = nearNext && (shortfallFor?.({ dateKey, bill }) ?? 0) > 0;
            return (
              <PressScale
                key={`${bill.sourceId ?? bill.name}:${dateKey}`}
                accessibilityRole="button"
                accessibilityLabel={`${bill.name}, ${formatDisplayMoneyAbsolute(bill.amount)}, ${countdownLabel(days)}${short ? ', solde insuffisant' : ''}`}
                scaleTo={0.95}
                onPress={() => open(() => onOpen({ dateKey, bill }))}
                style={[
                  styles.card,
                  {
                    backgroundColor: sameDay ? featuredFill : colors.containerBackground,
                    borderColor: sameDay ? featuredFill : colors.containerBorder,
                  },
                ]}
              >
                <View style={styles.cardTop}>
                  <PayIcon bill={bill} />
                  {/* Shortfall = a small warning glyph by the date, so every card keeps the same height. */}
                  <View style={styles.cardWhenRow}>
                    {short ? <AppIcon family="ionicons" name="warning" size={13} color={AMBER} /> : null}
                    <Text
                      style={[styles.cardWhen, { color: short ? AMBER : sameDay ? colors.text : colors.textMuted }]}
                    >
                      {countdownLabel(days)}
                    </Text>
                  </View>
                </View>
                <FitText
                  style={[styles.cardName, jakartaSemiboldText, { color: colors.text }]}
                  fontSize={13.5}
                  lineHeight={18}
                  minScale={0.75}
                >
                  {bill.name}
                </FitText>
                <FitText
                  style={[moneyAmountTypography({ tier: 'stat', fontSize: 17 }), { color: colors.text }]}
                  fontSize={17}
                  lineHeight={22}
                  minScale={0.6}
                >
                  {`−${formatDisplayMoneyAbsolute(bill.amount)}`}
                </FitText>
              </PressScale>
            );
          })}
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Ouvrir l'agenda"
            scaleTo={0.95}
            onPress={() => open(() => onOpen())}
            style={[styles.card, styles.moreCard, { borderColor: colors.containerBorder }]}
          >
            <View style={[styles.moreIcon, { backgroundColor: colors.surfaceElevated }]}>
              <AppIcon family="ionicons" name="calendar-outline" size={20} color={colors.text} />
            </View>
            <Text style={[styles.moreText, jakartaSemiboldText, { color: colors.text }]}>Voir l’agenda</Text>
          </PressScale>
        </ScrollView>
      ) : null}
    </View>
  );
}

/* ───────────────────────── Où va l'argent ───────────────────────── */

export function SpendingSnapshot({
  categories,
  onOpenCategory,
}: {
  categories: readonly BudgetCategoryUiModel[];
  /** Opens that category's budget detail. */
  onOpenCategory: (categoryId: string) => void;
}) {
  const { colors, isLight } = useAppTheme();
  const spending = categories.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent);
  const total = spending.reduce((sum, c) => sum + c.spent, 0);
  if (total <= 0) return null;
  const top = spending.slice(0, TOP_CATEGORIES);
  const otherSpent = total - top.reduce((sum, c) => sum + c.spent, 0);
  const tones = isLight ? MONO_TONES_LIGHT : MONO_TONES_DARK;
  const segments = [
    ...top.map((c, i) => ({ key: c.id, share: c.spent / total, color: tones[i % tones.length]! })),
    ...(otherSpent > 0 ? [{ key: 'other', share: otherSpent / total, color: colors.borderStrong }] : []),
  ];

  return (
    <ListCard padding={16}>
        <View style={styles.stack}>
          {segments.map((s) => (
            <View key={s.key} style={{ flex: s.share, backgroundColor: s.color }} />
          ))}
        </View>
        {top.map((c, i) => {
          const share = c.spent / total;
          const color = tones[i % tones.length]!;
          return (
            <PressScale
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={`${c.name}, ${formatDisplayMoneyAbsolute(c.spent)}, ouvrir le budget`}
              scaleTo={0.98}
              onPress={() => open(() => onOpenCategory(c.id))}
            >
            <View style={[styles.catRow, i === 0 && { marginTop: 14 }]}>
              <View style={[styles.catIcon, { backgroundColor: colors.surfaceElevated }]}>
                <BudgetCategoryIcon icon={c.icon} name={c.name} id={c.id} wellSize={32} glyphSize={16} />
              </View>
              <View style={styles.catBody}>
                <View style={styles.catLine}>
                  <FitText style={[styles.catName, jakartaSemiboldText, { color: colors.text }]}>
                    {c.name}
                  </FitText>
                  <Text style={[moneyAmountTypography({ tier: 'card', fontSize: 14 }), styles.catAmount, { color: colors.text }]}>
                    {formatDisplayMoneyAbsolute(c.spent)}
                  </Text>
                </View>
                <View style={styles.catLine}>
                  <AnimatedBar
                    progress={share}
                    color={color}
                    trackColor={colors.borderSubtle}
                    height={5}
                    delay={i * 80}
                    style={styles.catBar}
                  />
                  <Text style={[styles.catPct, { color: colors.textMuted }]}>{`${Math.round(share * 100)} %`}</Text>
                </View>
              </View>
            </View>
            </PressScale>
          );
        })}
    </ListCard>
  );
}

/* ───────────────────────── Objectifs ───────────────────────── */

/** Single goal → one full-width landscape card: ring on the left, numbers on the right. */
export function GoalWideCard({
  name,
  icon,
  saved,
  target,
  hidden = false,
  onPress,
}: {
  name: string;
  icon: React.ReactNode;
  saved: number;
  target: number;
  /** Wallet « hide balances » mode — amounts masked, ring/percent stay. */
  hidden?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const progress = target > 0 ? Math.min(1, saved / target) : 0;
  const left = Math.max(0, target - saved);
  const show = (value: number) => (hidden ? '••••' : formatDisplayMoneyAbsolute(value));
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${Math.round(progress * 100)} %`}
      scaleTo={0.97}
      onPress={() => open(onPress)}
      style={[styles.goalWide, { backgroundColor: colors.containerBackground }]}
    >
      <RingGauge progress={progress} color={colors.accentGreen} size={72} stroke={6}>
        <View style={[styles.goalWideIcon, { backgroundColor: colors.surfaceElevated }]}>{icon}</View>
      </RingGauge>
      <View style={styles.goalWideBody}>
        <View style={styles.catLine}>
          <FitText style={[styles.goalWideName, jakartaSemiboldText, { color: colors.text }]}>{name}</FitText>
          <Text style={[styles.goalWidePct, jakartaSemiboldText, { color: colors.accentGreen }]}>
            {`${Math.round(progress * 100)} %`}
          </Text>
        </View>
        <FitText
          style={[moneyAmountTypography({ tier: 'stat', fontSize: 22 }), { color: colors.text }]}
          fontSize={22}
          lineHeight={28}
          minScale={0.6}
        >
          {`${show(saved)} `}
          <Text style={[styles.sub, jakartaMediumText, { color: colors.textMuted }]}>
            {`sur ${show(target)}`}
          </Text>
        </FitText>
        <Text style={[styles.sub, jakartaMediumText, { color: colors.textMuted }]}>
          {left > 0 ? `Encore ${show(left)}` : 'Objectif atteint'}
        </Text>
      </View>
    </PressScale>
  );
}

/** Loan card → one full-width landscape card: ring on the left showing repayment %, numbers on the right. */
export function LoanWideCard({
  name,
  icon,
  principal,
  remaining,
  hidden = false,
  onPress,
}: {
  name: string;
  icon: React.ReactNode;
  principal: number;
  remaining: number;
  /** Wallet « hide balances » mode — amounts masked, ring/percent stay. */
  hidden?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const progress = principal > 0 ? Math.min(1, Math.max(0, principal - remaining) / principal) : 0;
  const done = principal > 0 && remaining <= 0.005;
  const show = (value: number) => (hidden ? '••••' : formatDisplayMoneyAbsolute(value));
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${Math.round(progress * 100)} % remboursé`}
      scaleTo={0.97}
      onPress={() => open(onPress)}
      style={[styles.goalWide, { backgroundColor: colors.containerBackground }]}
    >
      <RingGauge progress={progress} color={colors.accentGreen} size={72} stroke={6}>
        <View style={[styles.goalWideIcon, { backgroundColor: colors.surfaceElevated }]}>{icon}</View>
      </RingGauge>
      <View style={styles.goalWideBody}>
        <View style={styles.catLine}>
          <FitText style={[styles.goalWideName, jakartaSemiboldText, { color: colors.text }]}>{name}</FitText>
          <Text style={[styles.goalWidePct, jakartaSemiboldText, { color: colors.accentGreen }]}>
            {`${Math.round(progress * 100)} %`}
          </Text>
        </View>
        <FitText
          style={[moneyAmountTypography({ tier: 'stat', fontSize: 22 }), { color: colors.text }]}
          fontSize={22}
          lineHeight={28}
          minScale={0.6}
        >
          {`${show(remaining)} `}
          <Text style={[styles.sub, jakartaMediumText, { color: colors.textMuted }]}>
            {`sur ${show(principal)}`}
          </Text>
        </FitText>
        <Text style={[styles.sub, jakartaMediumText, { color: colors.textMuted }]}>
          {done ? 'Remboursé !' : `${show(remaining)} restant`}
        </Text>
      </View>
    </PressScale>
  );
}

export function GoalsOverview({
  saved,
  target,
  count,
  reached,
}: {
  saved: number;
  target: number;
  count: number;
  reached: number;
}) {
  const { colors } = useAppTheme();
  const progress = target > 0 ? Math.min(1, saved / target) : 0;
  return (
    <ListCard padding={16}>
      <View style={styles.headRow}>
        <View style={styles.headCopy}>
          <FitText style={[styles.eyebrow, { color: colors.textMuted }]}>
            Épargné au total
          </FitText>
          <FitText
            style={[moneyAmountTypography({ tier: 'stat', fontSize: 26 }), { color: colors.text }]}
            fontSize={26}
            lineHeight={32}
            minScale={0.6}
          >
            {formatDisplayMoneyAbsolute(saved)}
          </FitText>
          <FitText style={[styles.sub, jakartaMediumText, { color: colors.textMuted }]}>
            {`sur ${formatDisplayMoneyAbsolute(target)}`}
          </FitText>
        </View>
        <View style={styles.headPills}>
          <View style={[styles.pill, { backgroundColor: withAlpha('#22C55E', 0.16) }]}>
            <Text style={[styles.pillText, { color: colors.accentGreen }]}>{`${Math.round(progress * 100)} %`}</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: colors.surfaceElevated }]}>
            <AppIcon family="ionicons" name="trophy-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.pillText, { color: colors.textSecondary }]}>
              {`${reached}/${count}`}
            </Text>
          </View>
        </View>
      </View>
      <AnimatedBar
        progress={progress}
        color={colors.accentGreen}
        trackColor={colors.borderSubtle}
        height={8}
        style={styles.goalBar}
      />
    </ListCard>
  );
}

const styles = StyleSheet.create({
  goalWide: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 18, padding: 16 },
  goalWideIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  goalWideBody: { flex: 1, minWidth: 0, gap: 2 },
  goalWideName: { fontSize: 15, flexShrink: 1 },
  goalWidePct: { fontSize: 13, flexShrink: 0 },
  hero: { gap: 16 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroCopy: { flexShrink: 1, flexGrow: 1, minWidth: 0 },
  heroName: { letterSpacing: -0.2 },
  heroBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  heroAmount: { flexShrink: 1, flexGrow: 1 },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: 15,
    flexShrink: 0,
  },
  countdownText: { ...typographyKit.metaSemibold, fontSize: 12.5 },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 10, borderRadius: 10 },
  warningText: { ...typographyKit.metaSemibold, fontSize: 12.5, flexShrink: 1 },
  cardWhenRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headCopy: { flexShrink: 1, flexGrow: 1, minWidth: 0 },
  headPills: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  eyebrow: { ...typographyKit.eyebrow, fontSize: 11, letterSpacing: 0.6, marginBottom: 2 },
  sub: { fontSize: 12, marginTop: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 14,
    flexShrink: 0,
  },
  pillText: { ...typographyKit.metaSemibold, fontSize: 12.5 },
  carousel: { marginTop: 10, marginHorizontal: -PAGE_PADDING_HORIZONTAL },
  carouselContent: { paddingHorizontal: PAGE_PADDING_HORIZONTAL, gap: 10 },
  card: {
    width: CARD_WIDTH,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 6,
  },
  cardWhen: { ...typographyKit.metaSemibold, fontSize: 12, flexShrink: 0 },
  cardName: { letterSpacing: -0.2 },
  moreCard: { alignItems: 'center', justifyContent: 'center', gap: 8, width: 104, borderStyle: 'dashed', borderWidth: 1 },
  moreIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 12.5, textAlign: 'center' },
  stack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  catIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  catBody: { flexShrink: 1, flexGrow: 1, minWidth: 0, gap: 6 },
  catLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  catName: { fontSize: 14, flexShrink: 1, flexGrow: 1 },
  catAmount: { flexShrink: 0 },
  catBar: { flexGrow: 1, flexShrink: 1 },
  catPct: { ...typographyKit.metaSemibold, fontSize: 11, minWidth: 38, textAlign: 'right' },
  goalBar: { marginTop: 14 },
});
