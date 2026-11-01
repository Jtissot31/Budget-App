/**
 * Top of the account detail page: the account as a dark metal card with a hint of its bank's
 * colour, and the balance as the headline. Decorative only: the number is just the last digits.
 * Chequing and credit accounts get an engraved chip; a savings or cash account has no physical
 * card, so it keeps the same shape without it. The page title already names the account.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FitText } from '@/components/kit/FitText';
import { Reveal, useCountUp } from '@/components/kit/motion';
import { accountDetailBalanceCaption, InstitutionMark, formatSignedBalance } from '@/components/wallet/AccountCardPrototypes';
import { jakartaMediumText, moneyAmountTypography, spacing } from '@/constants/theme';
import { accountBalanceRowTitle, accountKindTypeLabel } from '@/lib/accountBalancePresentation';
import { accountCardGradient } from '@/lib/institutionBrandColor';
import { useAppTheme } from '@/lib/themeContext';
import type { SimulatedAccount } from '@/types';

/** Real bank card format (ISO ID-1): 85.60 × 53.98 mm. */
const BANK_CARD_RATIO = 85.6 / 53.98;
const CARD_RADIUS = 20;
const LOGO_SIZE = 34;
const CARD_TEXT = '#FFFFFF';
const CARD_TEXT_MUTED = 'rgba(255,255,255,0.62)';
const ENGRAVED_FILL = 'rgba(255,255,255,0.05)';
const ENGRAVED_LINE = 'rgba(255,255,255,0.16)';

function accountLastDigits(account: SimulatedAccount): string {
  const digits = (account.last4 ?? '').replace(/\D/g, '').slice(-4);
  return digits || (account.name.match(/(\d{4})\s*$/)?.[1] ?? '');
}

/** Payment chip in the card's own tone, drawn with plain Views. */
function EngravedChip() {
  return (
    <View style={styles.chip}>
      <View style={styles.chipLineH} />
      <View style={[styles.chipLineH, styles.chipLineHLow]} />
      <View style={styles.chipLineV} />
    </View>
  );
}

export function AccountBankCard({ account }: { account: SimulatedAccount }) {
  const { colors } = useAppTheme();
  const [cardWidth, setCardWidth] = useState(0);
  const minHeight = cardWidth > 0 ? Math.round(cardWidth / BANK_CARD_RATIO) : undefined;
  const balance = useCountUp(account.balance);
  const digits = accountLastDigits(account);
  const hasPhysicalCard = account.kind === 'checking' || account.kind === 'credit';

  return (
    <Reveal>
      <View
        onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}
        style={[styles.card, { minHeight, borderColor: colors.containerBorder }]}
        accessible
        accessibilityLabel={`${accountBalanceRowTitle(account)}, ${accountDetailBalanceCaption(account)} ${formatSignedBalance(account.balance)}`}
      >
        <LinearGradient
          colors={accountCardGradient(account)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.top}>
          <InstitutionMark account={account} size={LOGO_SIZE} transparentWell tile />
          {hasPhysicalCard ? <EngravedChip /> : null}
        </View>

        <View style={styles.bottom}>
          <View style={styles.amountBlock}>
            <Text style={styles.caption} numberOfLines={1}>
              {accountDetailBalanceCaption(account)}
            </Text>
            <FitText
              style={[moneyAmountTypography({ tier: 'stat', fontSize: 30 }), { color: CARD_TEXT }]}
              fontSize={30}
              lineHeight={38}
              minScale={0.55}
              responsive
              accessibilityLabel={formatSignedBalance(account.balance)}
            >
              {formatSignedBalance(balance)}
            </FitText>
          </View>
          <View style={styles.identity}>
            <Text style={styles.caption} numberOfLines={1}>
              {accountKindTypeLabel(account.kind)}
            </Text>
            {digits ? <Text style={styles.digits}>•••• {digits}</Text> : null}
          </View>
        </View>
      </View>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  // Height is a minimum, not aspectRatio: the card grows with a large Android font scale instead of cropping.
  card: {
    padding: spacing.lg + 2,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'space-between',
    gap: spacing.xl,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },

  chip: {
    width: 36,
    height: 27,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: ENGRAVED_LINE,
    backgroundColor: ENGRAVED_FILL,
    overflow: 'hidden',
  },
  chipLineH: { position: 'absolute', left: 0, right: 0, top: 8, height: 1, backgroundColor: ENGRAVED_LINE },
  chipLineHLow: { top: 16 },
  chipLineV: { position: 'absolute', top: 0, bottom: 0, left: 17, width: 1, backgroundColor: ENGRAVED_LINE },

  bottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  amountBlock: { flexGrow: 1, flexShrink: 1, gap: 2 },
  identity: { flexShrink: 0, alignItems: 'flex-end', gap: 2, paddingBottom: 5 },
  caption: { ...jakartaMediumText, fontSize: 12.5, lineHeight: 16, color: CARD_TEXT_MUTED },
  digits: { ...jakartaMediumText, fontSize: 13.5, lineHeight: 18, color: CARD_TEXT, fontVariant: ['tabular-nums'] },
});
