/**
 * Balance tab account tile — picture layout (icon, chip, name, subtitle, amount).
 * Fixed frame from {@link BALANCE_ACCOUNT_TILE}. Not the patrimoine / Onyx row card.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BALANCE_ACCOUNT_TILE,
  balanceAccountTileFrameStyle,
  onyxContainerPressedStyle,
} from '@/constants/planFinanceKit';
import { moneyAmountTypography, spacing, typographyKit } from '@/constants/theme';
import { accountBalanceDisplayName } from '@/lib/accountBalancePresentation';
import {
  formatDisplayMoneyAbsolute,
  formatSignedDisplayMoney,
} from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';
import type { AccountKind, SimulatedAccount } from '@/types';

const ICON_SIZE = 18;

type ChipTone = 'muted' | 'success' | 'danger';

function kindIcon(kind: AccountKind): keyof typeof Ionicons.glyphMap {
  if (kind === 'credit') return 'card-outline';
  if (kind === 'savings') return 'wallet-outline';
  if (kind === 'cash') return 'cash-outline';
  return 'business-outline';
}

function formatRateChip(rate: number): string {
  const rounded = Math.round(rate * 10) / 10;
  const body = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace('.', ',');
  return `${body} %`;
}

function roleChip(account: SimulatedAccount): { label: string; tone: ChipTone } {
  if (account.kind === 'credit') return { label: 'Crédit', tone: 'danger' };
  if (account.kind === 'cash') return { label: 'Comptant', tone: 'muted' };
  if (account.kind === 'savings') {
    const rate = account.interestRate;
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
      return { label: formatRateChip(rate), tone: 'success' };
    }
    return { label: 'Épargne', tone: 'muted' };
  }
  return { label: 'Principal', tone: 'muted' };
}

function maskedLast4(last4: string | undefined): string {
  const digits = (last4 ?? '').replace(/\D/g, '').slice(-4);
  return digits ? `••${digits}` : '';
}

function nextDueDate(dueDay: number): Date | null {
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let monthOffset = 0; monthOffset < 14; monthOffset += 1) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const last = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    if (dueDay > last) continue;
    const due = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
    if (due >= start) return due;
  }
  return null;
}

function accountSubtitle(account: SimulatedAccount): string {
  if (account.kind === 'cash') return 'Portefeuille';
  if (account.kind === 'credit' && account.dueDay != null) {
    const due = nextDueDate(account.dueDay);
    if (due) {
      const label = due.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
      return `Échéance ${label}`;
    }
  }
  return maskedLast4(account.last4);
}

function amountColor(
  account: SimulatedAccount,
  colors: { text: string; success: string; danger: string },
): string {
  if (account.balance < 0) return colors.danger;
  if (account.kind === 'savings') return colors.success;
  return colors.text;
}

function formatBalance(balance: number): string {
  if (balance < 0) return formatSignedDisplayMoney(balance);
  return formatDisplayMoneyAbsolute(balance);
}

export function BalanceAccountTile({
  account,
  hideBalance = false,
  chip,
}: {
  account: SimulatedAccount;
  hideBalance?: boolean;
  /** Replaces the role chip (manage-mode check). */
  chip?: ReactNode;
}) {
  const { colors } = useAppTheme();
  const role = roleChip(account);
  const chipColor =
    role.tone === 'danger' ? colors.danger : role.tone === 'success' ? colors.success : colors.textMuted;
  const iconColor =
    account.kind === 'credit'
      ? colors.danger
      : account.kind === 'savings'
        ? colors.success
        : colors.textSecondary;
  const name = accountBalanceDisplayName(account) || 'Compte';
  const subtitle = accountSubtitle(account);

  return (
    <View
      style={[
        balanceAccountTileFrameStyle(),
        styles.card,
        {
          backgroundColor: colors.modalSurface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.topRow}>
        <Ionicons name={kindIcon(account.kind)} size={ICON_SIZE} color={iconColor} />
        {chip ?? (
          <View
            style={[
              styles.chip,
              role.tone === 'danger' && { backgroundColor: colors.dangerMuted },
            ]}
          >
            <Text style={[styles.chipLabel, { color: chipColor }]} numberOfLines={1}>
              {role.label}
            </Text>
          </View>
        )}
      </View>

      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
        {subtitle}
      </Text>

      <View style={styles.amountSlot}>
        <Text
          style={[
            moneyAmountTypography({ tier: 'card' }),
            styles.amount,
            { color: hideBalance ? colors.text : amountColor(account, colors) },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {hideBalance ? '••••' : formatBalance(account.balance)}
        </Text>
      </View>
    </View>
  );
}

export function BalanceAccountAddTile({ onPress }: { onPress: () => void }) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ajouter un compte"
      onPress={onPress}
      style={({ pressed }) => [balanceAccountTileFrameStyle(), pressed && onyxContainerPressedStyle()]}
    >
      <View
        style={[
          styles.card,
          styles.addCard,
          {
            backgroundColor: colors.modalSurface,
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name="add" size={22} color={colors.textMuted} />
        <Text style={[styles.addLabel, { color: colors.textMuted }]} numberOfLines={1}>
          Ajouter
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...balanceAccountTileFrameStyle(),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BALANCE_ACCOUNT_TILE.radius,
    padding: BALANCE_ACCOUNT_TILE.padding,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  chip: {
    flexShrink: 1,
    maxWidth: '70%',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipLabel: {
    ...typographyKit.microMedium,
    fontSize: 11,
    lineHeight: 14,
  },
  name: {
    ...typographyKit.rowTitle,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typographyKit.microMedium,
    marginTop: spacing.xs,
    minHeight: typographyKit.microMedium.lineHeight,
  },
  amountSlot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  amount: {
    flexShrink: 1,
  },
  addCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addLabel: {
    ...typographyKit.metaMedium,
  },
});
