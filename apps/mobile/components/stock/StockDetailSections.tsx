import { type ReactNode } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassContainer } from '@/components/GlassContainer';
import { SurfaceCard } from '@/components/SurfaceCard';
import type {
  MockStockDetail,
  StockActivityItem,
  StockRecurringPurchase,
} from '@/constants/mockStockDetail';
import {
  jakartaBoldText,
  jakartaExtraBoldText,
  moneyAmountTypography,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { formatDisplayMoney, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';

function StockDetailSectionCard({
  children,
  style,
  padding = spacing.lg,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
}) {
  return (
    <SurfaceCard style={[styles.detailSectionCard, style]} padding={padding}>
      {children}
    </SurfaceCard>
  );
}

export function StockIssuerRow({ detail }: { detail: MockStockDetail }) {
  const { colors } = useAppTheme();
  const logoSize = 36;
  return (
    <View style={styles.issuerRow}>
      <View
        style={[
          styles.logoBadge,
          {
            width: logoSize,
            height: logoSize,
            borderRadius: logoSize / 2,
            backgroundColor: detail.logoColor,
          },
        ]}
      >
        <Text style={[styles.logoLetter, { fontSize: logoSize * 0.42 }]}>{detail.logoLetter}</Text>
      </View>
      <Text style={[styles.issuerName, { color: colors.text }]}>{detail.issuerName}</Text>
    </View>
  );
}

export function StockHeroPriceRow({ detail }: { detail: MockStockDetail }) {
  const { colors } = useAppTheme();
  const { main } = formatDisplayMoney(detail.holding.pricePerShare);
  return (
    <View style={styles.heroPriceRow}>
      <View style={styles.heroAmountGroup}>
        <Text style={[moneyAmountTypography({ tier: 'netWorth' }), { color: colors.text }]}>
          {main}
        </Text>
        <Text style={[moneyAmountTypography({ tier: 'netWorth' }), styles.heroDollar, { color: colors.text }]}>
          $
        </Text>
      </View>
      <Text style={[styles.currencyTag, { color: colors.textMuted }]}>{detail.currency}</Text>
    </View>
  );
}

export function StockPeriodPerformance({
  delta,
  deltaPercent,
  periodLabel,
}: {
  delta: number;
  deltaPercent: number;
  periodLabel: string;
}) {
  const { colors } = useAppTheme();
  const positive = delta >= 0;
  const color = positive ? colors.success : colors.danger;
  const dollarPart = formatSignedDisplayMoney(delta, { leadingPlusWhenPositive: true });
  const percentFormatted = `${deltaPercent >= 0 ? '+' : '−'}${Math.abs(deltaPercent).toLocaleString('fr-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`;

  return (
    <Text style={[styles.periodPerformance, { color }]}>
      {`${dollarPart.replace('$', ' $')} (${percentFormatted}) ${periodLabel}`}
    </Text>
  );
}

function MarketCell({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.marketCell}>
      <Text style={[styles.marketLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.marketValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function formatQuotePrice(value: number): string {
  const { main } = formatDisplayMoney(value);
  return main;
}

export function StockMarketDataGrid({ detail }: { detail: MockStockDetail }) {
  const q = detail.marketQuote;
  const left = [
    { label: 'Acheteur', value: formatQuotePrice(q.bid) },
    { label: 'Vendeur', value: formatQuotePrice(q.ask) },
    { label: 'Dernière vente', value: formatQuotePrice(q.lastSale) },
    { label: 'Ouverture', value: formatQuotePrice(q.open) },
    { label: 'Haut', value: formatQuotePrice(q.high) },
    { label: 'Bas', value: formatQuotePrice(q.low) },
    { label: 'Bourse', value: q.exchange },
  ];
  const right = [
    { label: 'Cap. bour.', value: q.marketCap },
    { label: 'Ratio C/B', value: q.peRatio },
    { label: 'Haut 52 sem.', value: formatQuotePrice(q.week52High) },
    { label: 'Bas 52 sem.', value: formatQuotePrice(q.week52Low) },
    { label: 'Volume', value: q.volume },
    { label: 'Volume moy.', value: q.avgVolume },
    { label: 'Marge obl.', value: q.marginRequirement },
  ];

  return (
    <View style={styles.marketGrid}>
      <View style={styles.marketColumn}>
        {left.map((item) => (
          <MarketCell key={item.label} label={item.label} value={item.value} />
        ))}
      </View>
      <View style={styles.marketColumn}>
        {right.map((item) => (
          <MarketCell key={item.label} label={item.label} value={item.value} />
        ))}
      </View>
    </View>
  );
}

export function StockSectionLink({
  title,
  onPress,
}: {
  title: string;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.sectionLink, pressed && styles.pressed]}
    >
      <Text style={[typographyKit.sectionTitle, { color: colors.text }]}>{title}</Text>
      <AppIcon family="ionicons" name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

function RecurringCard({ item }: { item: StockRecurringPurchase }) {
  const { colors } = useAppTheme();
  return (
    <GlassContainer borderRadius={radius.lg} padding={spacing.md} style={styles.recurringCard}>
      <Text style={[styles.recurringDate, { color: colors.text }]}>{item.nextDateLabel}</Text>
      <Text style={[styles.recurringMeta, { color: colors.textMuted }]}>{item.frequency}</Text>
      <Text style={[styles.recurringMeta, { color: colors.textMuted }]}>{item.account}</Text>
      <Text style={[moneyAmountTypography({ tier: 'card' }), { color: colors.text, marginTop: spacing.sm }]}>
        {formatCompactCurrency(item.amount)}
      </Text>
    </GlassContainer>
  );
}

export function StockRecurringPurchasesSection({ items }: { items: StockRecurringPurchase[] }) {
  if (items.length === 0) return null;
  return (
    <StockDetailSectionCard>
      <StockSectionLink title="Achats récurrents" />
      <View style={styles.recurringRow}>
        {items.map((item) => (
          <RecurringCard key={item.id} item={item} />
        ))}
      </View>
    </StockDetailSectionCard>
  );
}

function ActivityRow({ item }: { item: StockActivityItem }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.activityRow}>
      <View style={styles.activityLeft}>
        <Text style={[typographyKit.rowTitle, { color: colors.text }]}>{item.type}</Text>
        <Text style={[typographyKit.listSubtitle, { color: colors.textMuted }]}>{item.account}</Text>
      </View>
      <View style={styles.activityRight}>
        <Text style={[moneyAmountTypography({ tier: 'row' }), { color: colors.text }]}>
          {formatCompactCurrency(item.amount)}
        </Text>
        <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]}>{item.dateLabel}</Text>
      </View>
    </View>
  );
}

export function StockActivitySection({ items }: { items: StockActivityItem[] }) {
  const { colors } = useAppTheme();
  if (items.length === 0) return null;
  return (
    <StockDetailSectionCard>
      <StockSectionLink title="Activité" />
      <View style={styles.activityList}>
        {items.map((item, index) => (
          <View
            key={item.id}
            style={
              index < items.length - 1
                ? [styles.activityDivider, { borderBottomColor: colors.border }]
                : undefined
            }
          >
            <ActivityRow item={item} />
          </View>
        ))}
      </View>
    </StockDetailSectionCard>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.infoRow}>
      <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typographyKit.bodyMedium, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export function StockDividendsSection({ detail }: { detail: MockStockDetail }) {
  const { colors } = useAppTheme();
  return (
    <StockDetailSectionCard>
      <Text style={[typographyKit.sectionTitle, styles.sectionTitleStatic, { color: colors.text }]}>
        Dividendes
      </Text>
      <InfoRow label="Fréquence" value={detail.dividends.frequency} />
      <InfoRow label="Rendement sur 12 mois" value={detail.dividends.yield12m} />
      <InfoRow label="Date ex-dividende" value={detail.dividends.exDate} />
    </StockDetailSectionCard>
  );
}

function ReturnRow({
  label,
  dollar,
  percent,
}: {
  label: string;
  dollar: number;
  percent: number;
}) {
  const { colors } = useAppTheme();
  const positive = dollar >= 0;
  const color = positive ? colors.success : colors.danger;
  const dollarText = formatSignedDisplayMoney(dollar, { leadingPlusWhenPositive: true });
  const percentText = `${percent >= 0 ? '+' : '−'}${Math.abs(percent).toLocaleString('fr-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`;

  return (
    <View style={styles.holdingReturnRow}>
      <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[moneyAmountTypography({ tier: 'row' }), { color }]}>
        {`${dollarText} (${percentText})`}
      </Text>
    </View>
  );
}

export function StockHoldingsSection({ detail }: { detail: MockStockDetail }) {
  const { colors } = useAppTheme();
  const p = detail.position;
  return (
    <StockDetailSectionCard>
      <Text style={[typographyKit.sectionTitle, styles.sectionTitleStatic, { color: colors.text }]}>
        Titres
      </Text>
      <View style={styles.holdingCardInner}>
        <Text style={[styles.sharesLabel, { color: colors.text }]}>{p.sharesLabel}</Text>
        <Text style={[moneyAmountTypography({ tier: 'stat' }), { color: colors.text, marginTop: spacing.xs }]}>
          {formatCompactCurrency(p.totalValue)}
        </Text>
        <View style={[styles.holdingDivider, { backgroundColor: colors.border }]} />
        <InfoRow label="Coût comptable" value={formatCompactCurrency(p.bookCost)} />
        <InfoRow label="Prix moyen" value={formatCompactCurrency(p.avgPrice)} />
        <InfoRow label={`% de compte ${p.accountName}`} value={p.accountPercent} />
        <ReturnRow label="Rendement du jour" dollar={p.dayReturnDollar} percent={p.dayReturnPercent} />
        <ReturnRow label="Rendement total" dollar={p.totalReturnDollar} percent={p.totalReturnPercent} />
      </View>
    </StockDetailSectionCard>
  );
}

export function StockCategoriesSection({ categories }: { categories: string[] }) {
  const { colors } = useAppTheme();
  if (categories.length === 0) return null;
  return (
    <StockDetailSectionCard>
      <Text style={[typographyKit.sectionTitle, styles.sectionTitleStatic, { color: colors.text }]}>
        Catégories
      </Text>
      <View style={styles.chipRow}>
        {categories.map((category) => (
          <View
            key={category}
            style={[styles.chip, { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder }]}
          >
            <Text style={[typographyKit.metaSemibold, { color: colors.text }]}>{category}</Text>
          </View>
        ))}
      </View>
    </StockDetailSectionCard>
  );
}

export function StockAboutSection({ title, body }: { title: string; body: string }) {
  const { colors } = useAppTheme();
  return (
    <StockDetailSectionCard>
      <Text style={[typographyKit.sectionTitle, styles.sectionTitleStatic, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[typographyKit.body, { color: colors.text }]}>{body}</Text>
    </StockDetailSectionCard>
  );
}

export function StockDisclaimerSection() {
  const { colors } = useAppTheme();
  return (
    <StockDetailSectionCard>
      <Text style={[typographyKit.sectionTitle, styles.sectionTitleStatic, { color: colors.text }]}>
        Avis de non-responsabilité
      </Text>
      <Text style={[typographyKit.metaMedium, styles.disclaimer, { color: colors.textMuted }]}>
        Les actualités et données de marché proviennent de sources tierces et ne sont pas vérifiées par
        Budget Tracker. Les informations affichées sont fournies à titre indicatif seulement.
      </Text>
      <Pressable accessibilityRole="link">
        <Text style={[typographyKit.metaSemibold, { color: colors.textMuted }]}>
          En savoir plus sur les actualités
        </Text>
      </Pressable>
    </StockDetailSectionCard>
  );
}

export function StockPriceDataLink({ onPress }: { onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.priceDataLink, pressed && styles.pressed]}
    >
      <Text style={[typographyKit.metaSemibold, { color: colors.textMuted }]}>Données de prix</Text>
      <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

export function StockMarketDataSection({
  detail,
  onPriceDataPress,
}: {
  detail: MockStockDetail;
  onPriceDataPress: () => void;
}) {
  return (
    <StockDetailSectionCard>
      <StockPriceDataLink onPress={onPriceDataPress} />
      <StockMarketDataGrid detail={detail} />
    </StockDetailSectionCard>
  );
}

const styles = StyleSheet.create({
  logoBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    ...jakartaExtraBoldText,
    color: '#FFFFFF',
  },
  issuerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  issuerName: {
    ...jakartaBoldText,
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  heroPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroAmountGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroDollar: {
    marginLeft: 2,
  },
  currencyTag: {
    ...jakartaBoldText,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  periodPerformance: {
    ...jakartaBoldText,
    fontSize: 15,
    lineHeight: 20,
    marginTop: -spacing.sm,
  },
  marketGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  marketColumn: {
    flex: 1,
    gap: spacing.lg,
  },
  marketCell: {
    gap: 4,
  },
  marketLabel: {
    ...typographyKit.metaMedium,
  },
  marketValue: {
    ...moneyAmountTypography({ tier: 'row', fontSize: 15 }),
  },
  sectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailSectionCard: {
    gap: spacing.sm,
  },
  sectionTitleStatic: {
    marginBottom: spacing.xs,
  },
  recurringRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  recurringCard: {
    flex: 1,
    minWidth: 0,
  },
  recurringDate: {
    ...jakartaExtraBoldText,
    fontSize: 16,
  },
  recurringMeta: {
    ...typographyKit.metaMedium,
    marginTop: 2,
  },
  activityList: {
    gap: 0,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  activityLeft: {
    flex: 1,
    gap: 2,
  },
  activityRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  activityDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  holdingCardInner: {
    gap: spacing.xs,
  },
  sharesLabel: {
    ...jakartaExtraBoldText,
    fontSize: 28,
    letterSpacing: -0.8,
    lineHeight: 33,
  },
  holdingDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.sm,
  },
  holdingReturnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  disclaimer: {
    lineHeight: 20,
  },
  priceDataLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.78,
  },
});
