import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { jakartaMediumText, jakartaSemiboldText, moneyAmountTypography } from '@/constants/theme';
import { creditUsedFromBalance } from '@/lib/creditLimitUtilization';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import type { AccountKind, SimulatedAccount } from '@/types';

/** ISO/IEC 7810 ID-1 credit card aspect ratio (85.6 × 54 mm). */
const CARD_ASPECT_RATIO = 1.586;

const CARD = {
  fill: '#101010',
  border: 'rgba(255, 255, 255, 0.08)',
  accentStripe: 'rgba(255, 255, 255, 0.06)',
  label: 'rgba(255, 255, 255, 0.45)',
  number: 'rgba(255, 255, 255, 0.85)',
  name: 'rgba(255, 255, 255, 0.7)',
  text: '#ffffff',
  negative: '#ff5555',
  positive: '#4ade80',
  creditMeta: 'rgba(255, 255, 255, 0.42)',
} as const;

const CARD_RADIUS = 18;
const CARD_PADDING = 14;
const BANK_LOGO_SIZE = 40;

function extractLast4FromName(name: string): string | null {
  const digits = name.replace(/\D/g, '');
  if (digits.length === 0) return null;
  return digits.slice(-4);
}

function normalizeLast4(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return null;
  return digits.slice(-4);
}

function resolveCardLast4(account: SimulatedAccount): string | null {
  const explicit = account.last4?.trim();
  if (explicit) return normalizeLast4(explicit);
  return extractLast4FromName(account.name);
}

function formatMaskedCardNumber(last4: string | null) {
  if (last4) {
    return `···· ···· ···· ${last4}`;
  }
  return '···· ···· ···· ····';
}

function accountFooterLabel(account: SimulatedAccount) {
  const institution = account.institution?.trim();
  if (institution) return institution.toUpperCase();
  return account.name.trim();
}

function kindBadgeLabel(kind: AccountKind, account: SimulatedAccount) {
  if (kind === 'checking') return 'Chèque';
  if (kind === 'savings') return 'Épargne';
  return creditNetworkBadge(account);
}

function creditNetworkBadge(account: SimulatedAccount): string {
  const haystack = `${account.name} ${account.institution ?? ''}`.toLowerCase();
  const hasVisa = /\bvisa\b/.test(haystack);
  const hasMc =
    /\bmaster\s*card\b/.test(haystack) ||
    /\bmastercard\b/.test(haystack) ||
    /\bvisa\s*mc\b/.test(haystack) ||
    /\bmc\b/.test(haystack);
  if (hasVisa && hasMc) return 'Visa MC';
  if (hasVisa) return 'Visa';
  if (hasMc) return 'MC';
  return 'Crédit';
}

function resolveBalanceDisplay(account: SimulatedAccount) {
  const kind = account.kind;

  if (kind === 'checking') {
    return {
      label: 'Solde disponible',
      amount: account.balance,
      color: account.balance < 0 ? CARD.negative : CARD.text,
    };
  }

  if (kind === 'savings') {
    return {
      label: 'Solde',
      amount: account.balance,
      color: account.balance < 0 ? CARD.negative : CARD.text,
    };
  }

  const creditUsed = creditUsedFromBalance(account.balance);

  if (account.balance > 0) {
    return {
      label: 'Solde',
      amount: account.balance,
      color: CARD.positive,
      leadingPlusWhenPositive: true,
    };
  }

  return {
    label: creditUsed > 0 ? 'Solde dû' : 'Solde',
    amount: creditUsed > 0 ? -creditUsed : creditUsed,
    color: CARD.text,
  };
}

function resolveCreditAvailable(account: SimulatedAccount) {
  const creditLimit =
    typeof account.creditLimit === 'number' && account.creditLimit > 0
      ? account.creditLimit
      : undefined;
  if (!creditLimit) return undefined;

  const creditUsed = creditUsedFromBalance(account.balance);
  return Math.max(0, creditLimit - creditUsed);
}

type BankAccountCardProps = {
  account: SimulatedAccount;
  logoUrl?: string | null;
};

export function BankAccountCard({ account, logoUrl }: BankAccountCardProps) {
  const balanceDisplay = resolveBalanceDisplay(account);
  const creditAvailable =
    account.kind === 'credit' ? resolveCreditAvailable(account) : undefined;
  const badgeLabel = kindBadgeLabel(account.kind, account);

  return (
    <View style={styles.card}>
      <View style={styles.accentStripe} pointerEvents="none" />

      <View style={styles.topRow}>
        {logoUrl ? (
          <Image
            source={{ uri: logoUrl }}
            style={styles.bankLogo}
            contentFit="contain"
            transition={150}
            cachePolicy="memory-disk"
            recyclingKey={logoUrl}
          />
        ) : (
          <View style={styles.bankLogoPlaceholder} />
        )}
      </View>

      <View style={styles.balanceZone}>
        <Text style={styles.balanceLabel}>{balanceDisplay.label}</Text>
        <Text
          style={[styles.balanceAmount, { color: balanceDisplay.color }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {formatCompactCurrency(balanceDisplay.amount, {
            leadingPlusWhenPositive: balanceDisplay.leadingPlusWhenPositive,
          })}
        </Text>
        {typeof creditAvailable === 'number' ? (
          <Text style={styles.creditMeta} numberOfLines={1}>
            Disponible{' '}
            <Text style={moneyAmountTypography({ tier: 'row', fontSize: 9, letterSpacing: 0.2, textAlign: 'right' })}>
              {formatCompactCurrency(creditAvailable)}
            </Text>
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Text style={styles.cardNumber} numberOfLines={1}>
          {formatMaskedCardNumber(resolveCardLast4(account))}
        </Text>
        <View style={styles.footerNameRow}>
          <Text style={styles.cardholder} numberOfLines={1}>
            {accountFooterLabel(account)}
          </Text>
          <Text style={styles.kindLabel}>{badgeLabel}</Text>
        </View>
      </View>
    </View>
  );
}

/** @deprecated Use BankAccountCard */
export const CheckingBankCard = BankAccountCard;

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: CARD_ASPECT_RATIO,
    backgroundColor: CARD.fill,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD.border,
    paddingHorizontal: CARD_PADDING,
    paddingVertical: CARD_PADDING - 2,
    overflow: 'hidden',
  },
  accentStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: CARD.accentStripe,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: BANK_LOGO_SIZE,
  },
  bankLogo: {
    width: BANK_LOGO_SIZE,
    height: BANK_LOGO_SIZE,
    flexShrink: 0,
  },
  bankLogoPlaceholder: {
    width: BANK_LOGO_SIZE,
    height: BANK_LOGO_SIZE,
    flexShrink: 0,
  },
  balanceZone: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingTop: 4,
    paddingBottom: 2,
    gap: 2,
  },
  balanceLabel: {
    ...jakartaMediumText,
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: CARD.label,
  },
  balanceAmount: {
    ...moneyAmountTypography({
      tier: 'stat',
      fontSize: 27,
      lineHeight: 31,
      letterSpacing: -0.6,
      textAlign: 'right',
    }),
  },
  creditMeta: {
    ...jakartaMediumText,
    fontSize: 9,
    letterSpacing: 0.2,
    color: CARD.creditMeta,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  footer: {
    gap: 6,
  },
  footerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardNumber: {
    ...jakartaSemiboldText,
    fontSize: 14,
    letterSpacing: 2.2,
    color: CARD.number,
    fontVariant: ['tabular-nums'],
  },
  kindLabel: {
    ...jakartaMediumText,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: CARD.label,
    flexShrink: 0,
  },
  cardholder: {
    ...jakartaSemiboldText,
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: CARD.name,
  },
});
