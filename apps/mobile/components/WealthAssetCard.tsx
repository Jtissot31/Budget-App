import { StyleSheet, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { containerSurfaceStyle, jakartaMediumText, moneyAmountTypography, radius } from '@/constants/theme';

import { typographyKit } from '@/constants/typographyKit';

import { formatCompactCurrency, formatCompactGainDollars } from '@/lib/formatCompactGainDollars';

import { useAppTheme } from '@/lib/themeContext';

import {

  getWealthAssetDisplayLabel,

  getWealthAssetDisplayValue,

  valuationSourceLabel,

  wealthAssetHeroSubtitle,

  wealthAssetTypeShortTag,

} from '@/lib/wealthAssetPresentation';

import { WealthMaterialIcon } from '@/components/WealthMaterialIcon';

import type { Loan, WealthAsset } from '@/types';



/** Portfolio tile — taller rounded rect, not payment-card proportions. */

const TILE_MIN_HEIGHT = 168;

const TILE_PADDING = 16;

const ICON_WELL_SIZE = 52;



type WealthAssetCardProps = {

  asset: WealthAsset;

  linkedLoan?: Loan | null;

};



function WealthAssetTopIcon({

  asset,

  isLight,

  iconColor,

}: {

  asset: WealthAsset;

  isLight: boolean;

  iconColor: string;

}) {

  if (asset.type === 'real_estate') {

    return <Ionicons name="home-outline" size={26} color={iconColor} />;

  }



  if (asset.material) {

    return <WealthMaterialIcon material={asset.material} size={30} isLight={isLight} />;

  }



  return <Ionicons name="diamond-outline" size={26} color={iconColor} />;

}



function formatShortValuationDate(value: string | null | undefined) {

  if (!value?.trim()) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric', year: 'numeric' });

}



export function WealthAssetCard({ asset, linkedLoan = null }: WealthAssetCardProps) {

  const { colors, isLight } = useAppTheme();

  const surface = containerSurfaceStyle(isLight);

  const displayValue = getWealthAssetDisplayValue(asset, linkedLoan);

  const valueLabel = getWealthAssetDisplayLabel(asset, linkedLoan);

  const gain = asset.currentValue - asset.purchaseCost;

  const gainPositive = gain >= 0;

  const pct =

    asset.purchaseCost !== 0 ? ((asset.currentValue - asset.purchaseCost) / asset.purchaseCost) * 100 : null;

  const pctLabel =

    pct === null ? null : Math.abs(pct) < 0.05 ? '0 %' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)} %`;

  const metaDate = formatShortValuationDate(asset.lastValuationAt ?? asset.purchaseDate ?? undefined);

  const valuationMeta = [valuationSourceLabel(asset), metaDate].filter(Boolean).join(' · ');

  const specLine = wealthAssetHeroSubtitle(asset);

  const typeTag = wealthAssetTypeShortTag(asset);

  const isBareSilverIcon = asset.type === 'precious_material' && asset.material === 'silver';



  return (

    <View style={[styles.tile, surface]}>

      <View style={styles.content}>

        <View style={styles.headerRow}>

          {isBareSilverIcon ? (

            <WealthAssetTopIcon asset={asset} isLight={isLight} iconColor={colors.textSecondary} />

          ) : (

            <View

              style={[

                styles.iconWell,

                {

                  borderColor: colors.border,

                  backgroundColor: colors.surfaceElevated,

                },

              ]}

            >

              <WealthAssetTopIcon asset={asset} isLight={isLight} iconColor={colors.textSecondary} />

            </View>

          )}



          <View style={styles.identityText}>

            <View style={styles.titleRow}>

              <Text style={[styles.assetName, { color: colors.text }]} numberOfLines={1}>

                {asset.name.trim()}

              </Text>

              <View

                style={[

                  styles.typeBadge,

                  {

                    backgroundColor: colors.surfaceElevated,

                    borderColor: colors.border,

                  },

                ]}

              >

                <Text style={[styles.typeBadgeText, { color: colors.textMuted }]} numberOfLines={1}>

                  {typeTag}

                </Text>

              </View>

            </View>

            {specLine ? (

              <Text style={[styles.specLine, { color: colors.textSecondary }]} numberOfLines={1}>

                {specLine}

              </Text>

            ) : null}

          </View>

        </View>



        <View style={styles.valueZone}>

          <Text style={[styles.valueLabel, { color: colors.textMuted }]}>{valueLabel}</Text>

          <Text

            style={[styles.valueAmount, { color: colors.text }]}

            numberOfLines={1}

            adjustsFontSizeToFit

            minimumFontScale={0.72}

          >

            {formatCompactCurrency(displayValue)}

          </Text>

        </View>



        <View style={styles.footer}>

          <Text style={[styles.footerLine, { color: colors.textMuted }]} numberOfLines={1}>

            <Text style={[styles.gainText, { color: gainPositive ? colors.success : colors.danger }]}>

              {formatCompactGainDollars(gain, { leadingPlusWhenPositive: true })}

              {pctLabel ? ` · ${pctLabel}` : ''}

            </Text>

            {valuationMeta ? (

              <Text style={[styles.footerMeta, { color: colors.textMuted }]}>

                {' · '}

                {valuationMeta}

              </Text>

            ) : null}

          </Text>

        </View>

      </View>

    </View>

  );

}



const styles = StyleSheet.create({

  tile: {

    width: '100%',

    minHeight: TILE_MIN_HEIGHT,

    borderRadius: radius.card,

    padding: TILE_PADDING,

  },

  content: {

    flex: 1,

    justifyContent: 'space-between',

    gap: 12,

  },

  headerRow: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: 12,

    minHeight: ICON_WELL_SIZE,

    minWidth: 0,

  },

  iconWell: {

    width: ICON_WELL_SIZE,

    height: ICON_WELL_SIZE,

    borderRadius: 14,

    borderWidth: StyleSheet.hairlineWidth,

    alignItems: 'center',

    justifyContent: 'center',

    flexShrink: 0,

    overflow: 'hidden',

  },

  identityText: {

    flex: 1,

    minWidth: 0,

    gap: 2,

  },

  titleRow: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: 8,

    maxWidth: '100%',

  },

  assetName: {

    ...typographyKit.listPrimary,

    flex: 1,

    minWidth: 0,

  },

  typeBadge: {

    borderRadius: 999,

    borderWidth: StyleSheet.hairlineWidth,

    paddingHorizontal: 8,

    paddingVertical: 3,

    flexShrink: 0,

  },

  typeBadgeText: {

    ...jakartaMediumText,

    fontSize: 9,

    letterSpacing: 1,

    textTransform: 'uppercase',

  },

  specLine: {

    ...typographyKit.listSubtitle,

  },

  valueZone: {

    alignItems: 'flex-end',

    justifyContent: 'center',

    paddingTop: 2,

    paddingBottom: 2,

    gap: 2,

    minWidth: 0,

  },

  valueLabel: {

    ...jakartaMediumText,

    fontSize: 9,

    letterSpacing: 1.1,

    textTransform: 'uppercase',

    textAlign: 'right',

  },

  valueAmount: {
    ...moneyAmountTypography({ tier: 'hero', textAlign: 'right' }),
  },

  footer: {

    minWidth: 0,

  },

  footerLine: {

    ...typographyKit.microMedium,

    fontVariant: ['tabular-nums'],

  },

  gainText: {
    ...moneyAmountTypography({ tier: 'row', fontSize: typographyKit.microMedium.fontSize }),
  },

  footerMeta: {

    ...jakartaMediumText,

    fontSize: 9,

    letterSpacing: 0.2,

    fontVariant: ['tabular-nums'],

  },

});


