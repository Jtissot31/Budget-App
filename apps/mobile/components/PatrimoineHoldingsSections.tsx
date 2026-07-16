import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import Sortable, { type SortableGridRenderItem } from 'react-native-sortables';
import { AppIcon } from '@/components/icons/AppIcon';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { StockHoldingTile } from '@/components/StockHoldingTile';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { floatingGlassButtonPressed } from '@/constants/floatingGlassButton';
import {
  planFinanceContainerPressedStyle,
  planFinanceContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import {
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
import { tapHaptic } from '@/lib/haptics';
import { getSelectedLucideIcon } from '@/lib/iconMigration/selectedLucideIcons';
import { WELL_GLYPH_WHITE } from '@/lib/mdiIconCatalog';
import {
  getOrderedMockStockHoldings,
  loadMockStockHoldingsOrder,
  mergeVisibleStockHoldingsOrder,
  persistMockStockHoldingsOrder,
} from '@/lib/mockStockHoldingsOrder';
import { useAppTheme } from '@/lib/themeContext';
import { userPickedIconGlyphSize, userPickedIconWellStyle } from '@/lib/userPickedIcon';
import {
  applyWealthAssetsDisplayOrder,
  loadWealthAssetsDisplayOrder,
  mergeVisibleWealthAssetsOrder,
  persistWealthAssetsDisplayOrder,
} from '@/lib/wealthAssetsDisplayOrder';
import {
  resolvePatrimoineWealthLucideIcon,
  resolveWealthAssetIcon,
} from '@/lib/wealthIcons';
import {
  formatWealthAssetWeight,
  formatWealthValueGainPercent,
  getPatrimoineLinkedMortgage,
  getWealthAssetDisplayValue,
  getWealthAssetValueGainPercent,
  sumWealthAssetsDisplayValue,
} from '@/lib/wealthAssetPresentation';
import type { Loan, WealthAsset } from '@/types';

const MAX_VISIBLE_ITEMS = 4;
const STOCK_DRAG_ACTIVATION_MS = 280;
const WEALTH_DRAG_ACTIVATION_MS = 280;

type Props = {
  wealthAssets: WealthAsset[];
  loansById: ReadonlyMap<string, Loan>;
  onAddWealthAsset: () => void;
  onOpenWealthAsset: (asset: WealthAsset) => void;
  onDragStateChange?: (dragging: boolean) => void;
};

function PatrimoineSectionHeader({
  label,
  totalValue,
  isFirst = false,
  titleVariant = 'eyebrow',
}: {
  label: string;
  totalValue: number;
  isFirst?: boolean;
  /** `hero` — muted section label above a dominant money amount. Default keeps uppercase eyebrow. */
  titleVariant?: 'eyebrow' | 'hero';
}) {
  const { colors } = useAppTheme();
  const isHero = titleVariant === 'hero';

  return (
    <View style={[styles.sectionHeader, isFirst && styles.sectionHeaderFirst]}>
      <View style={[styles.sectionHeaderLeft, isHero && styles.sectionHeaderLeftHero]}>
        <Text
          style={[
            isHero
              ? [styles.sectionHeroLabel, typographyKit.metaMedium]
              : [styles.sectionEyebrow, typographyKit.eyebrow],
            { color: isHero ? colors.textSecondary : colors.textMuted },
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            isHero
              ? moneyAmountTypography({ tier: 'hero' })
              : moneyAmountTypography({ fontSize: 24, lineHeight: 28 }),
            styles.sectionTotal,
            { color: colors.text },
          ]}
        >
          {formatCompactCurrency(totalValue)}
        </Text>
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
      style={({ pressed }) => [styles.expandLink, pressed && planFinanceContainerPressedStyle()]}
    >
      <Text style={[styles.expandLinkLabel, typographyKit.metaMedium, { color: colors.textMuted }]}>
        {expanded ? 'Réduire' : `Voir les ${hiddenCount} autres`}
      </Text>
    </Pressable>
  );
}

function PatrimoineWealthIconWell({
  asset,
  size = 44,
  style,
}: {
  asset: WealthAsset;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { isLight } = useAppTheme();
  const lucideName = resolvePatrimoineWealthLucideIcon(asset);
  const LucideGlyph = lucideName ? getSelectedLucideIcon(lucideName) : null;

  if (LucideGlyph) {
    const glyphSize = userPickedIconGlyphSize(size);
    return (
      <View style={[userPickedIconWellStyle(size, isLight), styles.iconWellWrap, style]}>
        <LucideGlyph color={WELL_GLYPH_WHITE} size={glyphSize} strokeWidth={2} />
      </View>
    );
  }

  return <UserPickedIconWell icon={resolveWealthAssetIcon(asset)} size={size} wellGlyphWhite style={style} />;
}

function WealthHoldingTileContent({
  asset,
  linkedLoan,
}: {
  asset: WealthAsset;
  linkedLoan?: Loan | null;
}) {
  const { colors } = useAppTheme();
  const displayValue = getWealthAssetDisplayValue(asset, linkedLoan);
  const assetTitle = asset.name.trim() || 'Patrimoine';
  const weightLabel = formatWealthAssetWeight(asset);
  const gainPercent = getWealthAssetValueGainPercent(asset);
  const gainUp = (gainPercent ?? 0) >= 0;
  const gainColor = gainUp ? DASHBOARD_VALUE_GREEN : BUDGET_DANGER_COLOR;

  return (
    <PlanFinanceContainer style={styles.wealthRow}>
      <PatrimoineWealthIconWell asset={asset} size={44} />
      <View style={styles.wealthCopy}>
        <Text style={[styles.assetName, typographyKit.rowTitle, { color: colors.text }]} numberOfLines={2}>
          {assetTitle}
        </Text>
        {weightLabel ? (
          <Text style={[styles.assetWeight, typographyKit.metaMedium, { color: colors.textMuted }]} numberOfLines={1}>
            {weightLabel}
          </Text>
        ) : null}
      </View>
      <View style={[styles.wealthAmountCol, gainPercent != null && styles.wealthAmountColWithGain]}>
        {gainPercent != null ? (
          <Text style={[styles.wealthGainCaption, typographyKit.metaSemibold, { color: gainColor }]}>
            {formatWealthValueGainPercent(gainPercent)}
          </Text>
        ) : null}
        <Text
          style={[moneyAmountTypography({ tier: 'row' }), styles.wealthValue, { color: colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {formatCompactCurrency(displayValue)}
        </Text>
      </View>
    </PlanFinanceContainer>
  );
}

function WealthHoldingSortableTile({
  asset,
  linkedLoan,
  onPress,
  showReorderAffordance,
}: {
  asset: WealthAsset;
  linkedLoan?: Loan | null;
  onPress: () => void;
  showReorderAffordance: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const assetTitle = asset.name.trim() || 'Patrimoine';

  return (
    <Sortable.Touchable
      accessibilityRole="button"
      accessibilityLabel={`Voir le détail du patrimoine ${assetTitle}`}
      accessibilityHint={
        showReorderAffordance
          ? "Maintiens appuyé puis fais glisser pour changer l'ordre."
          : undefined
      }
      onTap={onPress}
      onTouchesDown={() => setPressed(true)}
      onTouchesUp={() => setPressed(false)}
      style={[styles.wealthTilePressable, pressed && planFinanceContainerPressedStyle()]}
    >
      <WealthHoldingTileContent asset={asset} linkedLoan={linkedLoan} />
    </Sortable.Touchable>
  );
}

function WealthHoldingsGrid({
  assets,
  loansById,
  onOpenWealthAsset,
  onReorder,
  onDragStateChange,
}: {
  assets: readonly WealthAsset[];
  loansById: ReadonlyMap<string, Loan>;
  onOpenWealthAsset: (asset: WealthAsset) => void;
  onReorder: (nextAssets: WealthAsset[]) => void;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const showReorderAffordance = assets.length >= 2;

  const renderItem = useCallback<SortableGridRenderItem<WealthAsset>>(
    ({ item }) => (
      <WealthHoldingSortableTile
        asset={item}
        linkedLoan={getPatrimoineLinkedMortgage(item, loansById)}
        showReorderAffordance={showReorderAffordance}
        onPress={() => {
          onOpenWealthAsset(item);
        }}
      />
    ),
    [loansById, onOpenWealthAsset, showReorderAffordance],
  );

  return (
    <View style={styles.wealthList}>
      <Sortable.Grid
        columns={1}
        data={[...assets]}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        rowGap={spacing.sm}
        sortEnabled={showReorderAffordance}
        dragActivationDelay={WEALTH_DRAG_ACTIVATION_MS}
        activeItemScale={1.02}
        activeItemOpacity={0.96}
        inactiveItemOpacity={1}
        inactiveItemScale={1}
        overDrag="vertical"
        onDragStart={() => {
          tapHaptic();
          onDragStateChange?.(true);
        }}
        onDragEnd={({ data }) => {
          onDragStateChange?.(false);
          onReorder(data);
        }}
      />
    </View>
  );
}

function StockHoldingSortableTile({
  holding,
  onPress,
  showReorderAffordance,
}: {
  holding: MockStockHolding;
  onPress: () => void;
  showReorderAffordance: boolean;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <Sortable.Touchable
      accessibilityRole="button"
      accessibilityLabel={`Voir ${holding.ticker}`}
      accessibilityHint={
        showReorderAffordance
          ? "Maintiens appuyé puis fais glisser pour changer l'ordre."
          : undefined
      }
      onTap={onPress}
      onTouchesDown={() => setPressed(true)}
      onTouchesUp={() => setPressed(false)}
      style={[styles.stockTilePressable, pressed && planFinanceContainerPressedStyle()]}
    >
      <StockHoldingTile holding={holding} />
    </Sortable.Touchable>
  );
}

function StockHoldingsGrid({
  holdings,
  onPressHolding,
  onReorder,
  onDragStateChange,
}: {
  holdings: readonly MockStockHolding[];
  onPressHolding: (ticker: string) => void;
  onReorder: (nextHoldings: MockStockHolding[]) => void;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const showReorderAffordance = holdings.length >= 2;

  const renderItem = useCallback<SortableGridRenderItem<MockStockHolding>>(
    ({ item }) => (
      <StockHoldingSortableTile
        holding={item}
        showReorderAffordance={showReorderAffordance}
        onPress={() => {
          onPressHolding(item.ticker);
        }}
      />
    ),
    [onPressHolding, showReorderAffordance],
  );

  return (
    <View style={styles.stockGrid}>
      <Sortable.Grid
        columns={2}
        data={[...holdings]}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        rowGap={spacing.xl}
        columnGap={spacing.lg}
        sortEnabled={showReorderAffordance}
        dragActivationDelay={STOCK_DRAG_ACTIVATION_MS}
        activeItemScale={1.02}
        activeItemOpacity={0.96}
        inactiveItemOpacity={1}
        inactiveItemScale={1}
        overDrag="vertical"
        onDragStart={() => {
          tapHaptic();
          onDragStateChange?.(true);
        }}
        onDragEnd={({ data }) => {
          onDragStateChange?.(false);
          onReorder(data);
        }}
      />
    </View>
  );
}

export function PatrimoineHoldingsSections({
  wealthAssets,
  loansById,
  onAddWealthAsset,
  onOpenWealthAsset,
  onDragStateChange,
}: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [stocksExpanded, setStocksExpanded] = useState(false);
  const [wealthExpanded, setWealthExpanded] = useState(false);
  const [holdings, setHoldings] = useState<MockStockHolding[]>(() => getOrderedMockStockHoldings());
  const [orderedWealth, setOrderedWealth] = useState<WealthAsset[]>(() =>
    applyWealthAssetsDisplayOrder(wealthAssets),
  );

  useEffect(() => {
    let cancelled = false;
    void loadMockStockHoldingsOrder().then((ordered) => {
      if (!cancelled) setHoldings(ordered);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadWealthAssetsDisplayOrder(wealthAssets).then((ordered) => {
      if (!cancelled) setOrderedWealth(ordered);
    });
    return () => {
      cancelled = true;
    };
  }, [wealthAssets]);

  const portfolioTotal = mockStockPortfolioTotalValue(holdings);
  const wealthTotal = useMemo(
    () => sumWealthAssetsDisplayValue(orderedWealth, loansById),
    [orderedWealth, loansById],
  );

  const visibleStocks = stocksExpanded ? holdings : holdings.slice(0, MAX_VISIBLE_ITEMS);
  const hiddenStockCount = Math.max(holdings.length - MAX_VISIBLE_ITEMS, 0);
  const visibleWealth = wealthExpanded ? orderedWealth : orderedWealth.slice(0, MAX_VISIBLE_ITEMS);
  const hiddenWealthCount = Math.max(orderedWealth.length - MAX_VISIBLE_ITEMS, 0);

  const handleVisibleStocksReorder = useCallback(
    (nextVisible: MockStockHolding[]) => {
      const nextHoldings = mergeVisibleStockHoldingsOrder(holdings, nextVisible);
      setHoldings(nextHoldings);
      void persistMockStockHoldingsOrder(nextHoldings);
    },
    [holdings],
  );

  const handleVisibleWealthReorder = useCallback(
    (nextVisible: WealthAsset[]) => {
      const nextAssets = mergeVisibleWealthAssetsOrder(orderedWealth, nextVisible);
      setOrderedWealth(nextAssets);
      void persistWealthAssetsDisplayOrder(nextAssets);
    },
    [orderedWealth],
  );

  const sectionCardSurface = colors.containerBackground;
  const sectionBorder = colors.containerBorder;

  return (
    <View style={styles.root}>
      <View style={styles.sectionBlock}>
        <PatrimoineSectionHeader
          label="Portefeuille d'actions"
          totalValue={portfolioTotal}
          isFirst
          titleVariant="hero"
        />

        <StockHoldingsGrid
          holdings={visibleStocks}
          onPressHolding={(ticker) => {
            router.push({ pathname: '/stock/[ticker]', params: { ticker } });
          }}
          onReorder={handleVisibleStocksReorder}
          onDragStateChange={onDragStateChange}
        />

        <HoldingsExpandLink
          hiddenCount={hiddenStockCount}
          expanded={stocksExpanded}
          onPress={() => setStocksExpanded((value) => !value)}
        />
      </View>

      <View style={[styles.sectionSeparator, { backgroundColor: colors.containerBorder }]} />

      <View style={styles.sectionBlock}>
        <PatrimoineSectionHeader label="Biens matériels" totalValue={wealthTotal} titleVariant="hero" />

        {orderedWealth.length === 0 ? (
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
            <WealthHoldingsGrid
              assets={visibleWealth}
              loansById={loansById}
              onOpenWealthAsset={onOpenWealthAsset}
              onReorder={handleVisibleWealthReorder}
              onDragStateChange={onDragStateChange}
            />

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
  /** Tight label → amount so the money reads as the primary signal. */
  sectionHeaderLeftHero: {
    gap: spacing.xs,
  },
  sectionEyebrow: {
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionHeroLabel: {
    letterSpacing: -0.1,
  },
  sectionTotal: {
    textAlign: 'left',
  },
  sectionSeparator: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: spacing.md,
  },
  stockGrid: {
    width: '100%',
  },
  stockTilePressable: {
    width: '100%',
    minWidth: 0,
  },
  wealthList: {
    width: '100%',
  },
  wealthTilePressable: {
    width: '100%',
  },
  wealthRow: {
    ...planFinanceContainerRowLayoutStyle(),
    minHeight: 92,
  },
  iconWellWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  wealthCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 2,
  },
  assetName: {
    flexShrink: 1,
  },
  assetWeight: {
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  wealthAmountCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    justifyContent: 'center',
    maxWidth: '42%',
  },
  /** Pin gain % top-right, value lower — matches stock-tile hierarchy. */
  wealthAmountColWithGain: {
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  wealthValue: {
    textAlign: 'right',
    includeFontPadding: false,
  },
  wealthGainCaption: {
    fontSize: 11,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
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
});
