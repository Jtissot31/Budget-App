/**
 * Vue détaillée d'un objectif d'épargne — en un coup d'œil :
 * 1. Résumé : épargné (anneau), restant, échéance, jalons 25/50/75 %.
 * 2. Ton plan : versement, rythme, date prévue vs date cible + conseil concret.
 * 3. Évolution (graphique existant).
 * 4. Versements : historique récent.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GoalProgressChart } from '@/components/GoalProgressChart';
import {
  EmptyRow,
  IconWell,
  ListCard,
  ListRow,
  PillButton,
  RingGauge,
  SECTION_GAP,
  SectionLabel,
  SummaryCard,
  withAlpha,
} from '@/components/kit';
import { TransactionDayGroups } from '@/components/transactions/TransactionDayGroups';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { jakartaMediumText, spacing, typographyKit } from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { resolveSavingsGoalDisplayIcon } from '@/lib/getAutomaticGoalIcon';
import type { GoalProjection } from '@/lib/goalProjection';
import {
  fromWeeklyContributionAmount,
  savingsGoalContributionFrequencyLabel,
  type SavingsGoalContributionFrequency,
} from '@/lib/savingsGoalContribution';
import { useAppTheme } from '@/lib/themeContext';
import type { SavingsGoal, SimulatedAccount, Transaction } from '@/types';

const AMBER = '#F59E0B';
const MILESTONES = [0.25, 0.5, 0.75];
const HISTORY_GROUPS = 4;

function shortDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T12:00:00`) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
}

type Props = {
  goal: SavingsGoal;
  projection: GoalProjection | null;
  transactions: Transaction[];
  accounts: SimulatedAccount[];
  onEdit: () => void;
};

export function GoalDetailBody({ goal, projection, transactions, accounts, onEdit }: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();

  const target = Math.max(0, goal.targetAmount);
  const saved = Math.max(0, goal.currentAmount);
  const remaining = Math.max(0, target - saved);
  const ratio = target > 0 ? Math.min(1, saved / target) : 0;
  const done = remaining <= 0 && target > 0;

  const weekly = goal.weeklyContribution ?? 0;
  const frequency = (goal.contributionFrequency ?? 'weekly') as SavingsGoalContributionFrequency;
  const contribution = weekly > 0 ? fromWeeklyContributionAmount(weekly, frequency) : 0;
  const frequencyLabel = savingsGoalContributionFrequencyLabel(frequency).toLowerCase();

  const projectedDate = done ? null : projection?.weeksToGoal != null ? addWeeks(projection.weeksToGoal) : null;
  const dueDate = goal.dueDate?.trim() ? new Date(`${goal.dueDate.trim().slice(0, 10)}T12:00:00`) : null;
  const late = projectedDate != null && dueDate != null && projectedDate.getTime() > dueDate.getTime();
  const requiredWeekly = projection?.requiredWeekly ?? null;

  /** One concrete sentence telling what to do next. */
  const advice = done
    ? { tone: colors.accentGreen, icon: 'trophy-outline', text: 'Objectif atteint, bravo ! Tu peux en créer un nouveau.' }
    : weekly <= 0
      ? {
          tone: colors.textSecondary,
          icon: 'bulb-outline',
          text:
            requiredWeekly != null && requiredWeekly > 0
              ? `Mets ${formatDisplayMoneyAbsolute(requiredWeekly)} de côté par semaine pour tenir ta date cible.`
              : 'Ajoute un versement régulier pour voir quand tu atteindras ton objectif.',
        }
      : late && requiredWeekly != null
        ? {
            tone: AMBER,
            icon: 'alert-circle-outline',
            text: `À ce rythme tu finis après ta date cible. Passe à ${formatDisplayMoneyAbsolute(requiredWeekly)} / semaine pour l’atteindre à temps.`,
          }
        : {
            tone: colors.accentGreen,
            icon: 'checkmark-circle-outline',
            text: projectedDate
              ? `Sur la bonne voie : objectif atteint vers le ${shortDate(projectedDate)}.`
              : 'Sur la bonne voie.',
          };

  return (
    <View>
      <View style={styles.section}>
        <SummaryCard
          label={done ? 'Objectif atteint' : 'Épargné'}
          amount={formatDisplayMoneyAbsolute(saved)}
          amountValue={saved}
          formatAmount={formatDisplayMoneyAbsolute}
          badge={{ label: `${Math.round(ratio * 100)} %`, color: colors.accentGreen }}
          aside={
            <RingGauge progress={ratio} color={colors.accentGreen} size={76} stroke={7}>
              <UserPickedIconWell icon={resolveSavingsGoalDisplayIcon(goal)} size={40} />
            </RingGauge>
          }
          stats={[
            { label: 'Objectif', value: formatDisplayMoneyAbsolute(target) },
            { label: 'Restant', value: done ? '—' : formatDisplayMoneyAbsolute(remaining) },
            {
              label: 'Échéance',
              value: shortDate(dueDate) ?? shortDate(projectedDate) ?? '—',
              color: late ? AMBER : undefined,
            },
          ]}
        >
          <View style={styles.milestoneBlock}>
            <View style={[styles.track, { backgroundColor: colors.borderSubtle }]}>
              <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: colors.accentGreen }]} />
              {MILESTONES.map((m) => (
                <View
                  key={m}
                  style={[
                    styles.tick,
                    { left: `${m * 100}%`, backgroundColor: ratio >= m ? colors.background : colors.textMuted },
                  ]}
                />
              ))}
            </View>
            <View style={styles.milestoneLabels}>
              {['0', '25 %', '50 %', '75 %', '100 %'].map((label, index) => (
                <Text
                  key={label}
                  style={[
                    styles.milestoneText,
                    { color: ratio >= index * 0.25 && index > 0 ? colors.accentGreen : colors.textMuted },
                  ]}
                >
                  {label}
                </Text>
              ))}
            </View>
          </View>
        </SummaryCard>
      </View>

      <View style={styles.section}>
        <SectionLabel title="Ton plan" trailing={<PillButton label="Modifier" onPress={onEdit} />} />
        <ListCard>
          <View style={[styles.advice, { backgroundColor: withAlpha(toHex(advice.tone), 0.1) }]}>
            <IconWell icon={advice.icon as never} color={advice.tone} size={32} />
            <Text style={[styles.adviceText, jakartaMediumText, { color: colors.text }]}>{advice.text}</Text>
          </View>
          <ListRow
            leading={<IconWell icon="repeat" />}
            title="Versement"
            subtitle={weekly > 0 ? frequencyLabel : 'Aucun versement planifié'}
            value={weekly > 0 ? `+${formatDisplayMoneyAbsolute(contribution)}` : '—'}
            valueColor={weekly > 0 ? colors.accentGreen : colors.textMuted}
            onPress={onEdit}
          />
          <ListRow
            leading={<IconWell icon="flag-outline" />}
            title="Fin prévue"
            subtitle={projection?.weeksToGoal != null ? `À ce rythme · ${formatWeeks(projection.weeksToGoal)}` : undefined}
            value={done ? 'Atteint' : (shortDate(projectedDate) ?? '—')}
            valueColor={late ? AMBER : undefined}
          />
          <ListRow
            leading={<IconWell icon="calendar-outline" />}
            title="Date cible"
            value={shortDate(dueDate) ?? 'Aucune'}
            valueColor={dueDate ? undefined : colors.textMuted}
            isLast={projection?.budgetUseRatio == null}
            onPress={onEdit}
          />
          {projection?.budgetUseRatio != null ? (
            <ListRow
              leading={<IconWell icon="pie-chart-outline" />}
              title="Part de tes revenus"
              subtitle="Versement mensuel / revenu"
              value={`${Math.round(projection.budgetUseRatio * 100)} %`}
              isLast
            />
          ) : null}
        </ListCard>
      </View>

      <View style={styles.section}>
        <SectionLabel title="Évolution" />
        <ListCard padding={12}>
          <GoalProgressChart goal={goal} transactions={transactions} accounts={accounts} showAmountHero={false} />
        </ListCard>
      </View>

      <View style={styles.section}>
        <SectionLabel
          title="Versements"
          actionLabel={transactions.length > 0 ? 'Tout voir' : undefined}
          onAction={
            transactions.length > 0
              ? () => router.push({ pathname: '/savings-goal-transactions', params: { id: goal.id } })
              : undefined
          }
        />
        {transactions.length > 0 ? (
          <TransactionDayGroups transactions={transactions} accounts={accounts} maxGroups={HISTORY_GROUPS} />
        ) : (
          <ListCard>
            <EmptyRow label="Aucun versement pour l’instant" />
          </ListCard>
        )}
      </View>
    </View>
  );
}

function addWeeks(weeks: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + Math.ceil(weeks) * 7);
  return date;
}

function formatWeeks(weeks: number): string {
  if (weeks < 9) return `${weeks} semaine${weeks > 1 ? 's' : ''}`;
  const months = Math.round(weeks / 4.345);
  if (months < 24) return `${months} mois`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest > 0 ? `${years} an${years > 1 ? 's' : ''} et ${rest} mois` : `${years} an${years > 1 ? 's' : ''}`;
}

/** `withAlpha` needs a 6-digit hex; theme tokens may be rgba. */
function toHex(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#8E8E9A';
}

const styles = StyleSheet.create({
  section: { marginBottom: SECTION_GAP + spacing.sm },
  milestoneBlock: { marginTop: 4, gap: 6 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  tick: { position: 'absolute', top: 1, bottom: 1, width: 2, marginLeft: -1, borderRadius: 1 },
  milestoneLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  milestoneText: { ...typographyKit.metaSemibold, fontSize: 10.5 },
  advice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: 10,
    marginBottom: 4,
    padding: 12,
    borderRadius: 14,
  },
  adviceText: { flexShrink: 1, fontSize: 13, lineHeight: 18 },
});
