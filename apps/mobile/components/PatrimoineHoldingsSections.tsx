/**
 * Patrimoine — actions et biens matériels en listes groupées (style historique).
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyRow, IconWell, ListCard, ListRow, SectionLabel } from '@/components/kit';
import { StockHoldingLogo } from '@/components/StockHoldingTile';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import {
  formatStockDayChangePercent,
  mockStockHoldingTotalValue,
  mockStockPortfolioTotalValue,
  type MockStockHolding,
} from '@/constants/mockStockPortfolio';
import { spacing, typographyKit } from '@/constants/theme';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { getSelectedLucideIcon } from '@/lib/iconMigration/selectedLucideIcons';
import { WELL_GLYPH_WHITE } from '@/lib/mdiIconCatalog';
import {
  getOrderedMockStockHoldings,
  loadMockStockHoldingsOrder,
} from '@/lib/mockStockHoldingsOrder';
import { useAppTheme } from '@/lib/themeContext';
import { userPickedIconGlyphSize, userPickedIconWellStyle } from '@/lib/userPickedIcon';
import {
  applyWealthAssetsDisplayOrder,
  loadWealthAssetsDisplayOrder,
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

type Props = {
  wealthAssets: WealthAsset[];
  loansById: ReadonlyMap<string, Loan>;
  onAddWealthAsset: () => void;
  onOpenWealthAsset: (asset: WealthAsset) => void;
};

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

export function PatrimoineHoldingsSections({
  wealthAssets,
  loansById,
  onAddWealthAsset,
  onOpenWealthAsset,
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

  const totalLabel = (value: number) => (
    <Text style={[typographyKit.metaSemibold, { fontSize: 11, color: colors.textMuted }]}>
      {formatCompactCurrency(value)}
    </Text>
  );

  return (
    <View style={styles.root}>
      <View>
        <SectionLabel title="Actions" trailing={totalLabel(portfolioTotal)} />
        <ListCard>
          {visibleStocks.map((holding, index) => {
            const up = holding.dayChangePercent >= 0;
            const isLast = index === visibleStocks.length - 1 && hiddenStockCount === 0;
            return (
              <ListRow
                key={holding.id}
                leading={
                  <IconWell>
                    <StockHoldingLogo ticker={holding.ticker} />
                  </IconWell>
                }
                title={holding.ticker.split('.')[0] || holding.ticker}
                subtitle={`${holding.companyName} · ${holding.shares} parts`}
                value={formatCompactCurrency(mockStockHoldingTotalValue(holding))}
                valueSub={formatStockDayChangePercent(holding.dayChangePercent)}
                valueSubColor={up ? colors.accentGreen : colors.danger}
                isLast={isLast}
                onPress={() => router.push({ pathname: '/stock/[ticker]', params: { ticker: holding.ticker } })}
              />
            );
          })}
          {hiddenStockCount > 0 ? (
            <ListRow
              title={stocksExpanded ? 'Réduire' : `Voir les ${hiddenStockCount} autres`}
              chevron
              isLast
              onPress={() => setStocksExpanded((value) => !value)}
            />
          ) : null}
        </ListCard>
      </View>

      <View>
        <SectionLabel title="Biens matériels" trailing={totalLabel(wealthTotal)} />
        <ListCard>
          {orderedWealth.length === 0 ? (
            <EmptyRow label="Aucun bien enregistré — immobilier, or, véhicule…" />
          ) : (
            visibleWealth.map((asset) => {
              const linked = getPatrimoineLinkedMortgage(asset, loansById);
              const gain = getWealthAssetValueGainPercent(asset);
              return (
                <ListRow
                  key={asset.id}
                  leading={<PatrimoineWealthIconWell asset={asset} size={40} />}
                  title={asset.name.trim() || 'Bien'}
                  subtitle={formatWealthAssetWeight(asset) || undefined}
                  value={formatCompactCurrency(getWealthAssetDisplayValue(asset, linked))}
                  valueSub={gain != null ? formatWealthValueGainPercent(gain) : undefined}
                  valueSubColor={(gain ?? 0) >= 0 ? colors.accentGreen : colors.danger}
                  onPress={() => onOpenWealthAsset(asset)}
                />
              );
            })
          )}
          {hiddenWealthCount > 0 ? (
            <ListRow
              title={wealthExpanded ? 'Réduire' : `Voir les ${hiddenWealthCount} autres`}
              chevron
              onPress={() => setWealthExpanded((value) => !value)}
            />
          ) : null}
          <ListRow
            leading={<IconWell icon="add" color={colors.text} />}
            title="Ajouter un bien"
            isLast
            accessibilityLabel="Ajouter un bien physique"
            onPress={onAddWealthAsset}
          />
        </ListCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg + spacing.sm },
  iconWellWrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
