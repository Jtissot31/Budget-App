import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SurfaceCard } from '@/components/SurfaceCard';
import type {
  MockStockDetail,
  StockActivityItem,
  StockRecurringPurchase,
} from '@/constants/mockStockDetail';
import { jakartaBoldText, jakartaExtraBoldText } from '@/constants/plusJakartaFonts';
import {
  DASHBOARD_VALUE_GREEN,
  DASHBOARD_VALUE_RED,
  containerSurfaceStyle,
  detailSectionsCardStyle,
  moneyAmountTypography,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { formatDisplayMoney, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import { getStockLogoAsset } from '@/lib/stockLogo';
import { useAppTheme } from '@/lib/themeContext';

const IDENTITY_LOGO_SIZE = 44;

function StockDetailSectionCard({
  children,
  style,
  padding = spacing.lg,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
}) {
  const { isLight } = useAppTheme();
  const surface = containerSurfaceStyle(isLight);
  return (
    <SurfaceCard
      style={[
        detailSectionsCardStyle(),
        styles.detailSectionCard,
        {
          borderWidth: surface.borderWidth,
          borderColor: surface.borderColor,
        },
        style,
      ]}
      padding={padding}
    >
      {children}
    </SurfaceCard>
  );
}

/** Bundled stock mark (same resolver as StockHoldingTile), or letter fallback. */
function StockDetailIdentityLogo({ detail }: { detail: MockStockDetail }) {
  const ticker = detail.holding.ticker;
  const asset = useMemo(() => getStockLogoAsset(ticker), [ticker]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [asset]);

  const showLogo = Boolean(asset) && !failed;

  if (showLogo && asset) {
    return (
      <View style={styles.identityLogo}>
        <Image
          source={asset}
          style={styles.identityLogoImage}
          contentFit="contain"
          contentPosition="center"
          transition={0}
          cachePolicy="memory-disk"
          recyclingKey={`stock-detail-logo-${ticker}`}
          onError={() => setFailed(true)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.identityLogo, { backgroundColor: detail.logoColor }]}>
      <Text style={styles.identityLogoLetter}>{detail.logoLetter}</Text>
    </View>
  );
}

/** Logo + issuer name + ticker — sits above the position value hero. */
export function StockDetailIdentity({ detail }: { detail: MockStockDetail }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.identityRow}>
      <StockDetailIdentityLogo detail={detail} />
      <View style={styles.identityCopy}>
        <Text style={[typographyKit.rowTitle, { color: colors.text }]} numberOfLines={2}>
          {detail.issuerName}
        </Text>
        <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]}>
          {detail.displayTicker}
        </Text>
      </View>
    </View>
  );
}

/**
 * Premium minimalist stock detail hero — position value (or share price),
 * today's change ($ + %), and shares held. Open layout (no card shell).
 */
export function StockDetailHero({ detail }: { detail: MockStockDetail }) {
  const { colors } = useAppTheme();
  const held = detail.holding.shares > 0;
  const currentValue = held ? detail.position.totalValue : detail.holding.pricePerShare;
  const dayDollar = held
    ? detail.position.dayReturnDollar
    : detail.holding.pricePerShare * (detail.holding.dayChangePercent / 100);
  const dayPercent = held ? detail.position.dayReturnPercent : detail.holding.dayChangePercent;
  const positive = dayPercent >= 0;
  const changeColor = positive ? DASHBOARD_VALUE_GREEN : DASHBOARD_VALUE_RED;
  const { main } = formatDisplayMoney(currentValue);
  const dollarPart = formatSignedDisplayMoney(dayDollar, { leadingPlusWhenPositive: true });
  const percentFormatted = `${dayPercent >= 0 ? '+' : '−'}${Math.abs(dayPercent).toLocaleString('fr-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`;

  return (
    <View style={styles.detailHero}>
      <View style={styles.heroAmountGroup}>
        <Text style={[moneyAmountTypography({ tier: 'netWorth' }), { color: colors.text }]}>{main}</Text>
        <Text
          style={[moneyAmountTypography({ tier: 'netWorth' }), styles.heroDollar, { color: colors.text }]}
        >
          $
        </Text>
      </View>
      <Text style={[styles.heroDayChange, { color: changeColor }]}>
        {`${dollarPart.replace('$', ' $')}  ·  ${percentFormatted}`}
      </Text>
      <Text style={[styles.heroShares, { color: colors.textMuted }]}>{detail.position.sharesLabel}</Text>
    </View>
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
  const { colors, isLight } = useAppTheme();
  const surface = containerSurfaceStyle(isLight);
  return (
    <SurfaceCard
      padding={spacing.md}
      style={[
        styles.recurringCard,
        {
          borderWidth: surface.borderWidth,
          borderColor: surface.borderColor,
        },
      ]}
    >
      <Text style={[styles.recurringDate, { color: colors.text }]}>{item.nextDateLabel}</Text>
      <Text style={[styles.recurringMeta, { color: colors.textMuted }]}>{item.frequency}</Text>
      <Text style={[styles.recurringMeta, { color: colors.textMuted }]}>{item.account}</Text>
      <Text style={[moneyAmountTypography({ tier: 'card' }), { color: colors.text, marginTop: spacing.sm }]}>
        {formatCompactCurrency(item.amount)}
      </Text>
    </SurfaceCard>
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
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  identityLogo: {
    width: IDENTITY_LOGO_SIZE,
    height: IDENTITY_LOGO_SIZE,
    borderRadius: IDENTITY_LOGO_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  identityLogoImage: {
    width: IDENTITY_LOGO_SIZE,
    height: IDENTITY_LOGO_SIZE,
  },
  identityLogoLetter: {
    ...jakartaExtraBoldText,
    color: '#FFFFFF',
    fontSize: 17,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  detailHero: {
    gap: spacing.sm,
  },
  heroAmountGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroDollar: {
    marginLeft: 2,
  },
  heroDayChange: {
    ...jakartaBoldText,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  heroShares: {
    ...typographyKit.metaMedium,
    marginTop: 2,
  },
  logoBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    ...jakartaExtraBoldText,
    color: '#FFFFFF',
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
