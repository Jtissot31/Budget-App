import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/icons/AppIcon';
import { StockHoldingTile } from '@/components/StockHoldingTile';
import { floatingGlassButtonPressed } from '@/constants/floatingGlassButton';
import {
  MOCK_STOCK_HOLDINGS,
  formatStockDayChangePercent,
  mockStockPortfolioDayChangePercent,
  mockStockPortfolioTotalValue,
  type MockStockHolding,
} from '@/constants/mockStockPortfolio';
import {
  DASHBOARD_VALUE_GREEN,
  moneyAmountTypography,
  PORTFOLIO_SECTION_GAP,
  radius,
  spacing,
  typography,
  typographyKit,
} from '@/constants/theme';
import { BUDGET_DANGER_COLOR } from '@/lib/categoryBudgetUsage';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { getSelectedLucideIcon } from '@/lib/iconMigration/selectedLucideIcons';
import { useAppTheme } from '@/lib/themeContext';
import {
  getPatrimoineLinkedMortgage,
  getWealthAssetDisplayValue,
  sumWealthAssetsDisplayValue,
} from '@/lib/wealthAssetPresentation';
import type { Loan, WealthAsset } from '@/types';

const MAX_VISIBLE_ITEMS = 4;
const CARD_SURFACE = '#28282E';
const ICON_WELL_SIZE = 28;
const WEALTH_CARD_MIN_HEIGHT = 80;

type Props = {
  stockHoldingsCount: number;
  wealthAssets: WealthAsset[];
  loansById: ReadonlyMap<string, Loan>;
  onAddWealthAsset: () => void;
  onOpenWealthAsset: (asset: WealthAsset) => void;
};

function biensCountLabel(count: number): string {
  return count === 1 ? '1 bien' : `${count} biens`;
}

function positionsCountLabel(count: number): string {
  return count === 1 ? '1 position' : `${count} positions`;
}

function PatrimoineSectionHeader({
  label,
  totalValue,
  countLabel,
  dayChangePercent,
  isFirst = false,
}: {
  label: string;
  totalValue: number;
  countLabel: string;
  dayChangePercent?: number | null;
  isFirst?: boolean;
}) {
  const { colors } = useAppTheme();
  const dayUp = (dayChangePercent ?? 0) >= 0;
  const changeColor = dayUp ? DASHBOARD_VALUE_GREEN : BUDGET_DANGER_COLOR;

  return (
    <View style={[styles.sectionHeader, isFirst && styles.sectionHeaderFirst]}>
      <View style={styles.sectionHeaderLeft}>
        <Text style={[styles.sectionEyebrow, typographyKit.eyebrow, { color: colors.textMuted }]}>{label}</Text>
        <Text
          style={[
            moneyAmountTypography({ fontSize: 24, lineHeight: 28 }),
            styles.sectionTotal,
            { color: colors.text },
          ]}
        >
          {formatCompactCurrency(totalValue)}
        </Text>
      </View>

      <View style={styles.sectionHeaderRight}>
        {dayChangePercent != null ? (
          <Text style={[styles.sectionDayChange, typographyKit.captionSemibold, { color: changeColor }]}>
            {formatStockDayChangePercent(dayChangePercent)}
          </Text>
        ) : null}
        <Text style={[styles.sectionCount, typographyKit.caption, { color: colors.textMuted }]}>{countLabel}</Text>
      </View>
    </View>
  );
}

function HoldingsExpandLink({ hiddenCount, expanded, onPress }: { hiddenCount: number; expanded: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  if (hiddenCount <= 0) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={expanded ? 'Réduire la liste' : `Voir les ${hiddenCount} autres`}
      onPress={onPress}
      style={({ pressed }) => [styles.expandLink, pressed && styles.pressed]}
    >
      <Text style={[styles.expandLinkLabel, typographyKit.metaMedium, { color: colors.textMuted }]}>
        {expanded ? 'Réduire' : `Voir les ${hiddenCount} autres`}
      </Text>
    </Pressable>
  );
}

function WealthAssetIcon({ asset, color }: { asset: WealthAsset; color: string }) {
  const HouseIcon = getSelectedLucideIcon('House');
  const GemIcon = getSelectedLucideIcon('Gem');

  if (asset.type === 'real_estate' && HouseIcon) {
    return <HouseIcon size={15} color={color} strokeWidth={2} />;
  }
  if (GemIcon) {
    return <GemIcon size={15} color={color} strokeWidth={2} />;
  }
  return <AppIcon family="ionicons" name="diamond-outline" size={15} color={color} strokeWidth={2} />;
}

function WealthHoldingTile({
  asset,
  linkedLoan,
  onPress,
}: {
  asset: WealthAsset;
  linkedLoan?: Loan | null;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const displayValue = getWealthAssetDisplayValue(asset, linkedLoan);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voir le détail du patrimoine ${asset.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.wealthTilePressable, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.wealthCard,
          {
            backgroundColor: CARD_SURFACE,
            borderColor: colors.containerBorder,
          },
        ]}
      >
        <View style={styles.wealthIdentity}>
          <View style={[styles.iconWell, { backgroundColor: colors.surfaceElevated }]}>
            <WealthAssetIcon asset={asset} color={colors.textMuted} />
          </View>
          <Text style={[styles.assetName, typographyKit.captionSemibold, { color: colors.text }]} numberOfLines={1}>
            {asset.name}
          </Text>
        </View>

        <Text
          style={[moneyAmountTypography({ fontSize: 17, lineHeight: 21 }), styles.wealthValue, { color: colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {formatCompactCurrency(displayValue)}
        </Text>
      </View>
    </Pressable>
  );
}

function chunkInPairs<T>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += 2) {
    rows.push(items.slice(index, index + 2));
  }
  return rows;
}

function StockHoldingsGrid({
  holdings,
  onPressHolding,
}: {
  holdings: readonly MockStockHolding[];
  onPressHolding: (ticker: string) => void;
}) {
  const rows = chunkInPairs(holdings);

  return (
    <View style={styles.stockGrid}>
      {rows.map((row, rowIndex) => (
        <View
          key={row.map((holding) => holding.id).join('-')}
          style={[styles.stockRow, rowIndex < rows.length - 1 && styles.stockRowSpaced]}
        >
          {row.map((holding) => (
            <View key={holding.id} style={styles.stockTileSlot}>
              <StockHoldingTile
                holding={holding}
                onPress={() => {
                  onPressHolding(holding.ticker);
                }}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function WealthHoldingsList({ children }: { children: ReactNode }) {
  return <View style={styles.wealthList}>{children}</View>;
}

export function PatrimoineHoldingsSections({
  stockHoldingsCount,
  wealthAssets,
  loansById,
  onAddWealthAsset,
  onOpenWealthAsset,
}: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [stocksExpanded, setStocksExpanded] = useState(false);
  const [wealthExpanded, setWealthExpanded] = useState(false);

  const holdings = MOCK_STOCK_HOLDINGS;
  const portfolioTotal = mockStockPortfolioTotalValue(holdings);
  const portfolioDayChange = mockStockPortfolioDayChangePercent(holdings);
  const wealthTotal = useMemo(
    () => sumWealthAssetsDisplayValue(wealthAssets, loansById),
    [wealthAssets, loansById],
  );

  const visibleStocks = stocksExpanded ? holdings : holdings.slice(0, MAX_VISIBLE_ITEMS);
  const hiddenStockCount = Math.max(holdings.length - MAX_VISIBLE_ITEMS, 0);
  const visibleWealth = wealthExpanded ? wealthAssets : wealthAssets.slice(0, MAX_VISIBLE_ITEMS);
  const hiddenWealthCount = Math.max(wealthAssets.length - MAX_VISIBLE_ITEMS, 0);

  const sectionCardSurface = colors.containerBackground;
  const sectionBorder = colors.containerBorder;

  return (
    <View style={styles.root}>
      <View style={styles.sectionBlock}>
        <PatrimoineSectionHeader
          label="ACTIONS"
          totalValue={portfolioTotal}
          dayChangePercent={portfolioDayChange}
          countLabel={positionsCountLabel(stockHoldingsCount)}
          isFirst
        />

        <StockHoldingsGrid
          holdings={visibleStocks}
          onPressHolding={(ticker) => {
            router.push({ pathname: '/stock/[ticker]', params: { ticker } });
          }}
        />

        <HoldingsExpandLink
          hiddenCount={hiddenStockCount}
          expanded={stocksExpanded}
          onPress={() => setStocksExpanded((value) => !value)}
        />
      </View>

      <View style={[styles.sectionSeparator, { backgroundColor: colors.containerBorder }]} />

      <View style={styles.sectionBlock}>
        <PatrimoineSectionHeader
          label="BIENS PHYSIQUES"
          totalValue={wealthTotal}
          countLabel={biensCountLabel(wealthAssets.length)}
        />

        {wealthAssets.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={[styles.emptyText, typographyKit.metaMedium, { color: colors.textMuted }]}>
              Aucun bien physique enregistré. Ajoutes-en un pour qu&apos;il soit ajouté à ta valeur nette.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajouter un bien physique"
              onPress={onAddWealthAsset}
              style={({ pressed }) => [
                styles.addCta,
                { backgroundColor: sectionCardSurface, borderColor: sectionBorder },
                pressed && floatingGlassButtonPressed,
              ]}
            >
              <AppIcon family="ionicons" name="add" size={18} color={colors.textSecondary} />
              <Text style={[styles.addCtaLabel, typographyKit.metaSemibold, { color: colors.text }]}>Ajouter</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <WealthHoldingsList>
              {visibleWealth.map((asset) => (
                <WealthHoldingTile
                  key={asset.id}
                  asset={asset}
                  linkedLoan={getPatrimoineLinkedMortgage(asset, loansById)}
                  onPress={() => onOpenWealthAsset(asset)}
                />
              ))}
            </WealthHoldingsList>

            <HoldingsExpandLink
              hiddenCount={hiddenWealthCount}
              expanded={wealthExpanded}
              onPress={() => setWealthExpanded((value) => !value)}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajouter un bien physique"
              onPress={onAddWealthAsset}
              style={({ pressed }) => [
                styles.addCta,
                { backgroundColor: sectionCardSurface, borderColor: sectionBorder },
                pressed && floatingGlassButtonPressed,
              ]}
            >
              <AppIcon family="ionicons" name="add" size={18} color={colors.textSecondary} />
              <Text style={[styles.addCtaLabel, typographyKit.metaSemibold, { color: colors.text }]}>Ajouter</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: PORTFOLIO_SECTION_GAP + spacing.md,
  },
  sectionBlock: {
    gap: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionHeaderFirst: {
    marginTop: spacing.xl,
  },
  sectionHeaderLeft: {
    flex: 1,
    minWidth: 0,
    gap: spacing.md,
  },
  sectionHeaderRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    flexShrink: 0,
  },
  sectionEyebrow: {
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionTotal: {
    textAlign: 'left',
  },
  sectionDayChange: {
    fontSize: 13,
    lineHeight: 17,
    fontVariant: ['tabular-nums'],
  },
  sectionCount: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionSeparator: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: spacing.md,
  },
  stockGrid: {
    width: '100%',
  },
  stockRow: {
    flexDirection: 'row',
    width: '100%',
    gap: spacing.lg,
  },
  stockRowSpaced: {
    marginBottom: spacing.xl,
  },
  stockTileSlot: {
    flex: 1,
    width: '50%',
    minWidth: 0,
  },
  wealthList: {
    flexDirection: 'column',
    width: '100%',
    gap: spacing.xl,
  },
  wealthTilePressable: {
    width: '100%',
  },
  wealthCard: {
    width: '100%',
    minHeight: WEALTH_CARD_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  wealthIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWell: {
    width: ICON_WELL_SIZE,
    height: ICON_WELL_SIZE,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetName: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
  },
  wealthValue: {
    flexShrink: 0,
    maxWidth: '42%',
    textAlign: 'right',
    includeFontPadding: false,
  },
  expandLink: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  expandLinkLabel: {
    fontSize: typography.meta,
    textAlign: 'center',
  },
  emptyBlock: {
    gap: spacing.md,
  },
  emptyText: {
    lineHeight: 18,
  },
  addCta: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  addCtaLabel: {
    letterSpacing: 0.1,
  },
  pressed: {
    opacity: 0.88,
  },
});
