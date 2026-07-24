import { useMemo, useState, type ReactNode, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  AddArticleSheet,
  type InlineArticleScrollTarget,
} from '@/components/AddArticleSheet';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  articlesReceiptTypography,
  detailSubSectionHeaderStyle,
  FORM_SECTION_LABEL_STYLE,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import type { ItemizedNote } from '@/lib/itemizedNote';
import { useAppTheme } from '@/lib/themeContext';

type TextColors = {
  text: string;
  textMuted: string;
};

export type TransactionArticlesReceiptCardProps = {
  articles: ItemizedNote[];
  colors: TextColors;
  inlineArticleExpanded: boolean;
  maxArticlePrice: number | null;
  onOpenInlineArticle: () => void;
  onCloseInlineArticle: () => void;
  onAddArticle: (
    name: string,
    price: string,
    categoryId: string | null,
    categoryName: string | null,
  ) => void;
  onRemoveArticle: (index: number) => void;
  onInlineScrollTargetChange?: (target: InlineArticleScrollTarget) => void;
  scrollToOffset?: (localY: number, offset?: number) => void;
  inlineArticleFormRef?: RefObject<View | null>;
  onNameFocusChange?: (focused: boolean) => void;
  onContentLayout?: () => void;
  onInlineFormLayout?: (y: number) => void;
  onCardLayout?: (y: number) => void;
  /** Receipt attachment / scan block — rendered below Ajouter when provided */
  children?: ReactNode;
};

/** Receipt paper zigzag edge — SVG path tiling zigzag teeth across full width */
function ReceiptZigzagEdge({
  width,
  color,
  position,
}: {
  width: number;
  color: string;
  position: 'top' | 'bottom';
}) {
  const toothWidth = 10;
  const toothDepth = 7;
  const height = toothDepth;

  if (width <= 0) return null;

  const count = Math.max(1, Math.ceil(width / toothWidth));
  const totalWidth = width;
  const step = totalWidth / count;

  let d = '';
  if (position === 'top') {
    d = `M 0,${height}`;
    for (let i = 0; i < count; i++) {
      const x0 = i * step;
      const xMid = x0 + step / 2;
      const x1 = x0 + step;
      d += ` L ${xMid},0 L ${x1},${height}`;
    }
    d += ` L ${totalWidth},${height} Z`;
  } else {
    d = `M 0,0`;
    for (let i = 0; i < count; i++) {
      const x0 = i * step;
      const xMid = x0 + step / 2;
      const x1 = x0 + step;
      d += ` L ${xMid},${height} L ${x1},0`;
    }
    d += ` L ${totalWidth},0 Z`;
  }

  return (
    <Svg
      width={totalWidth}
      height={height}
      style={[styles.zigzag, position === 'top' ? { top: 0 } : { bottom: 0 }]}
      pointerEvents="none"
    >
      <Path d={d} fill={color} />
    </Svg>
  );
}

/**
 * ARTICLES receipt card — shared by transaction detail and add-transaction.
 * Matches the detail view: zigzag paper edges, muted header, dashed tear,
 * DM Mono line items, soft grey-white « Ajouter » CTA, inline AddArticleSheet.
 */
export function TransactionArticlesReceiptCard({
  articles,
  colors,
  inlineArticleExpanded,
  maxArticlePrice,
  onOpenInlineArticle,
  onCloseInlineArticle,
  onAddArticle,
  onRemoveArticle,
  onInlineScrollTargetChange,
  scrollToOffset,
  inlineArticleFormRef,
  onNameFocusChange,
  onContentLayout,
  onInlineFormLayout,
  onCardLayout,
  children,
}: TransactionArticlesReceiptCardProps) {
  const { isLight } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [measuredCardWidth, setMeasuredCardWidth] = useState(0);

  const total = useMemo(() => articles.reduce((sum, a) => sum + a.price, 0), [articles]);

  const cardFill = isLight ? '#FAFAFA' : '#0F0F10';
  const tearColor = isLight ? 'rgba(0,0,0,0.11)' : 'rgba(255,255,255,0.11)';
  const rowDivider = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  /** Muted grey-white CTA — softer than light `surfaceElevated` so it doesn’t glare on dark receipt. */
  const addCtaBackground = '#C8C8CE';
  const addCtaForeground = '#0D1117';
  const zigzagColor = cardFill;
  const zigzagDepth = 7;
  const cardWidth = measuredCardWidth > 0 ? measuredCardWidth : windowWidth - spacing.lg * 2;

  return (
    <View
      style={styles.card}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0 && nextWidth !== measuredCardWidth) {
          setMeasuredCardWidth(nextWidth);
        }
        onCardLayout?.(event.nativeEvent.layout.y);
      }}
    >
      <ReceiptZigzagEdge width={cardWidth} color={zigzagColor} position="top" />

      <View
        style={[
          styles.cardBody,
          {
            backgroundColor: cardFill,
            marginTop: zigzagDepth,
            marginBottom: zigzagDepth,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <AppIcon family="ionicons" name="receipt-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.sectionEyebrow, { color: colors.text }]}>ARTICLES</Text>
        </View>

        <View style={[styles.tearLine, { borderColor: tearColor }]} />

        {articles.length > 0 ? (
          <View style={styles.articlesBlock}>
            <View style={styles.tableHead}>
              <Text
                style={[detailSubSectionHeaderStyle(), styles.tableHeadLabel, { color: colors.textMuted }]}
              >
                Article
              </Text>
              <Text
                style={[detailSubSectionHeaderStyle(), styles.tableHeadAmount, { color: colors.textMuted }]}
              >
                Montant
              </Text>
              <View style={styles.tableHeadAction} />
            </View>
            {articles.map((article, index) => (
              <View
                key={`${article.name}-${index}`}
                style={[
                  styles.articleRow,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: rowDivider },
                ]}
              >
                <View style={styles.articleCopy}>
                  <Text
                    style={[styles.articleName, articlesReceiptTypography('regular'), { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {article.name}
                  </Text>
                  {article.categoryName ? (
                    <Text
                      style={[
                        styles.articleCategory,
                        articlesReceiptTypography('regular'),
                        { color: colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {article.categoryName}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.articlePrice, articlesReceiptTypography('medium'), { color: colors.text }]}>
                  {formatDisplayMoneyAbsolute(article.price)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Retirer ${article.name}`}
                  hitSlop={8}
                  onPress={() => onRemoveArticle(index)}
                  style={({ pressed }) => [styles.articleRemoveBtn, pressed && styles.pressed]}
                >
                  <AppIcon family="ionicons" name="close" size={13} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
            {total > 0 ? (
              <View style={[styles.totalRow, { borderTopColor: tearColor }]}>
                <Text
                  style={[styles.totalLabel, articlesReceiptTypography('medium'), { color: colors.textMuted }]}
                >
                  TOTAL
                </Text>
                <Text style={[styles.totalValue, articlesReceiptTypography('medium'), { color: colors.text }]}>
                  {formatDisplayMoneyAbsolute(total)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : !inlineArticleExpanded ? (
          <Text style={[styles.emptyText, articlesReceiptTypography('regular'), { color: colors.textMuted }]}>
            Entre des articles pour catégoriser
          </Text>
        ) : null}

        {inlineArticleExpanded ? (
          <View
            ref={inlineArticleFormRef}
            style={[
              styles.inlineFormWrap,
              articles.length > 0 && styles.inlineFormWrapBelowArticles,
              articles.length > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: rowDivider,
              },
            ]}
            onLayout={(event) => {
              onInlineFormLayout?.(event.nativeEvent.layout.y);
            }}
          >
            <AddArticleSheet
              variant="inline"
              visible={inlineArticleExpanded}
              maxArticlePrice={maxArticlePrice ?? undefined}
              scrollToOffset={scrollToOffset}
              onInlineScrollTargetChange={onInlineScrollTargetChange}
              onNameFocusChange={onNameFocusChange}
              onContentLayout={onContentLayout}
              onAdd={onAddArticle}
              onClose={onCloseInlineArticle}
            />
          </View>
        ) : null}

        {!inlineArticleExpanded ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter un article"
            onPress={onOpenInlineArticle}
            style={({ pressed }) => [
              styles.joinButton,
              { backgroundColor: addCtaBackground, borderColor: addCtaBackground },
              pressed && styles.pressed,
            ]}
          >
            <AppIcon family="ionicons" name="add" size={14} color={addCtaForeground} />
            <Text style={[styles.joinButtonText, typographyKit.bodyBold, { color: addCtaForeground }]}>
              Ajouter
            </Text>
          </Pressable>
        ) : null}

        {children}
      </View>

      <ReceiptZigzagEdge width={cardWidth} color={zigzagColor} position="bottom" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'visible',
  },
  cardBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.md + 2,
    overflow: 'visible',
  },
  zigzag: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  /** Match Date / Méthode / Catégorie eyebrows — stronger than nested Prix/Catégorie. */
  sectionEyebrow: {
    ...FORM_SECTION_LABEL_STYLE,
  },
  tearLine: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    marginBottom: spacing.xs,
  },
  inlineFormWrap: {
    overflow: 'visible',
    zIndex: 10,
  },
  inlineFormWrapBelowArticles: {
    marginTop: spacing.xs,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'stretch',
    minHeight: 36,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  joinButtonText: {
    letterSpacing: 0.2,
  },
  articlesBlock: {
    gap: spacing.xs,
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  tableHeadLabel: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  tableHeadAmount: {
    marginBottom: 0,
    textAlign: 'right',
    minWidth: 72,
  },
  tableHeadAction: {
    width: 26,
    flexShrink: 0,
  },
  articleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  articleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  articleName: {
    fontSize: 13,
    letterSpacing: 0.3,
    lineHeight: 18,
  },
  articleCategory: {
    fontSize: 10,
    letterSpacing: 0.4,
    lineHeight: 14,
  },
  articlePrice: {
    fontSize: 13,
    letterSpacing: 0.3,
    flexShrink: 0,
    minWidth: 72,
    textAlign: 'right',
  },
  articleRemoveBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  totalValue: {
    fontSize: 13,
    letterSpacing: 0.4,
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: spacing.md,
    letterSpacing: 0.4,
  },
  pressed: { opacity: 0.78 },
});
