import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { jakartaMediumText, radius, spacing, typography, typographyKit } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';
import type { AccountKind } from '@/types';

export type PaymentMethodAccount = {
  id: string;
  name: string;
  last4?: string | null;
  kind: AccountKind;
};

type PaymentMethodFieldProps = {
  label?: string;
  accounts: PaymentMethodAccount[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  chipControlStyle: ViewStyle;
  chipSelectedStyle: ViewStyle;
  selectedTextStyle: TextStyle;
  textSecondaryStyle: TextStyle;
  emptyHint?: string;
};

function iconForKind(kind: AccountKind): keyof typeof Ionicons.glyphMap {
  if (kind === 'credit') return 'card-outline';
  if (kind === 'savings') return 'cash-outline';
  if (kind === 'cash') return 'wallet-outline';
  return 'wallet-outline';
}

export function PaymentMethodField({
  label = 'Méthode de paiement',
  accounts,
  selectedAccountId,
  onSelectAccount,
  chipControlStyle,
  chipSelectedStyle,
  selectedTextStyle,
  textSecondaryStyle,
  emptyHint = 'Ajoute un compte pour enregistrer la dépense.',
}: PaymentMethodFieldProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.eyebrow, textSecondaryStyle]}>{label}</Text>
      <View style={styles.typeRow}>
        {accounts.length === 0 ? (
          <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{emptyHint}</Text>
        ) : (
          accounts.map((account) => {
            const selected = selectedAccountId === account.id;
            return (
              <Pressable
                key={account.id}
                onPress={() => onSelectAccount(account.id)}
                style={[styles.typeChip, selected ? chipSelectedStyle : chipControlStyle]}
              >
                <Ionicons
                  name={iconForKind(account.kind)}
                  size={15}
                  color={selected ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.typeChipText, selected ? selectedTextStyle : textSecondaryStyle]}>
                  {account.last4 ? `${account.name} • ${account.last4}` : account.name}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputGroup: {
    gap: spacing.sm,
  },
  eyebrow: {
    ...typographyKit.eyebrow,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  typeChipText: {
    ...jakartaMediumText,
    fontSize: typography.meta,
  },
  emptyHint: {
    ...jakartaMediumText,
    fontSize: typography.meta,
    lineHeight: 18,
  },
});
