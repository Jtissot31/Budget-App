import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { DashboardCard } from '@/components/DashboardCard';
import { ProgressBar } from '@/components/ProgressBar';
import {
  jakartaBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  moneyAmountTypography,
  radius,
  spacing,
} from '@/constants/theme';
import { gaugeZoneColor } from '@/lib/availableCashToday';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';

type PaycheckPreview = {
  amount: number;
  dateKey: string;
};

type Props = {
  availableToday: number;
  checkingBalanceTotal: number;
  upcomingBillsBeforePaycheck: number;
  gaugePercent: number;
  billCount: number;
  paycheck?: PaycheckPreview | null;
};

function formatAgendaShortDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  const weekday = date
    .toLocaleDateString('fr-FR', { weekday: 'short' })
    .replace(/\.$/, '')
    .toLowerCase();
  const day = date.getDate();
  const month = date.toLocaleDateString('fr-FR', { month: 'short' }).replace(/\.$/, '');
  const dayLabel = day === 1 ? '1er' : String(day);
  return `${weekday}. ${dayLabel} ${month}`;
}

function BreakdownStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'expense' | 'positive';
}) {
  const { colors } = useAppTheme();
  const valueColor =
    tone === 'expense' ? colors.warning : tone === 'positive' ? colors.accentGreen : colors.text;

  return (
    <View style={styles.breakdownStat}>
      <Text style={[styles.breakdownLabel, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.breakdownValue, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function AgendaCashHeroCard({
  availableToday,
  checkingBalanceTotal,
  upcomingBillsBeforePaycheck,
  gaugePercent,
  billCount,
  paycheck,
}: Props) {
  const { colors } = useAppTheme();
  const gaugeClamped = Math.max(0, Math.min(100, gaugePercent));
  const gaugeColor = gaugeZoneColor(gaugeClamped, colors);
  const billsLabel =
    billCount === 0
      ? 'Aucune facture'
      : billCount === 1
        ? '1 paiement prévu'
        : `${billCount} paiements prévus`;

  return (
    <DashboardCard padding={spacing.lg} innerStyle={styles.cardInner}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWell, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
          <AppIcon family="ionicons" name="wallet-outline" size={18} color={colors.text} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.textMuted }]}>Reste disponible</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Solde chèque moins tes factures, avant ta paie
          </Text>
        </View>
      </View>

      <Text style={[styles.amount, { color: colors.text }]}>
        {formatDisplayMoneyAbsolute(Math.abs(availableToday))}
      </Text>

      <View style={[styles.breakdownRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
        <BreakdownStat label="Solde chèque" value={formatDisplayMoneyAbsolute(checkingBalanceTotal)} />
        <View style={[styles.breakdownDivider, { backgroundColor: colors.borderSubtle }]} />
        <BreakdownStat
          label="À payer"
          value={upcomingBillsBeforePaycheck > 0 ? `−${formatDisplayMoneyAbsolute(upcomingBillsBeforePaycheck)}` : '0 $'}
          tone="expense"
        />
        <View style={[styles.breakdownDivider, { backgroundColor: colors.borderSubtle }]} />
        <BreakdownStat
          label="Reste"
          value={formatDisplayMoneyAbsolute(Math.abs(availableToday))}
          tone="positive"
        />
      </View>

      <View style={styles.gaugeBlock}>
        <View style={styles.gaugeHeader}>
          <Text style={[styles.gaugeLabel, { color: colors.textMuted }]}>{billsLabel}</Text>
          <Text style={[styles.gaugePercent, { color: gaugeColor }]}>{Math.round(gaugeClamped)} %</Text>
        </View>
        <ProgressBar progress={gaugeClamped / 100} color={gaugeColor} height={6} trackColor={colors.borderSubtle} />
        <Text style={[styles.gaugeHint, { color: colors.textMuted }]}>
          Part de ton solde chèque qui reste après les prélèvements prévus
        </Text>
      </View>

      {paycheck ? (
        <View style={[styles.paycheckRow, { borderTopColor: colors.borderSubtle }]}>
          <View style={[styles.paycheckIcon, { backgroundColor: `${colors.accentGreen}18` }]}>
            <AppIcon family="ionicons" name="arrow-down-circle-outline" size={16} color={colors.accentGreen} />
          </View>
          <View style={styles.paycheckCopy}>
            <Text style={[styles.paycheckTitle, { color: colors.text }]}>Prochaine paie</Text>
            <Text style={[styles.paycheckMeta, { color: colors.textMuted }]}>
              {formatAgendaShortDate(paycheck.dateKey)}
            </Text>
          </View>
          <Text style={[styles.paycheckAmount, { color: colors.accentGreen }]}>
            +{formatDisplayMoneyAbsolute(paycheck.amount)}
          </Text>
        </View>
      ) : (
        <View style={[styles.paycheckRow, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[styles.paycheckEmpty, { color: colors.textMuted }]}>
            Aucune paie estimée pour l’instant
          </Text>
        </View>
      )}
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  cardInner: {
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    paddingTop: 1,
  },
  eyebrow: {
    ...jakartaBoldText,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subtitle: {
    ...jakartaMediumText,
    fontSize: 12.5,
    lineHeight: 17,
  },
  amount: {
    ...moneyAmountTypography({
      fontSize: 34,
      lineHeight: 36,
      letterSpacing: -1.1,
    }),
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  breakdownStat: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  breakdownLabel: {
    ...jakartaMediumText,
    fontSize: 10.5,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  breakdownValue: {
    ...jakartaSemiboldText,
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  breakdownDivider: {
    width: 1,
    marginVertical: 2,
  },
  gaugeBlock: {
    gap: spacing.xs,
  },
  gaugeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  gaugeLabel: {
    ...jakartaMediumText,
    fontSize: 12,
    flex: 1,
    minWidth: 0,
  },
  gaugePercent: {
    ...jakartaBoldText,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  gaugeHint: {
    ...jakartaMediumText,
    fontSize: 11,
    lineHeight: 15,
  },
  paycheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
  paycheckIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paycheckCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  paycheckTitle: {
    ...jakartaSemiboldText,
    fontSize: 14,
  },
  paycheckMeta: {
    ...jakartaMediumText,
    fontSize: 12,
  },
  paycheckAmount: {
    ...jakartaBoldText,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  paycheckEmpty: {
    ...jakartaMediumText,
    fontSize: 12.5,
    flex: 1,
    textAlign: 'center',
  },
});
