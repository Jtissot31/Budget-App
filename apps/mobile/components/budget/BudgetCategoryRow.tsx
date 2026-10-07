/**
 * Budget category row — one Onyx card: icon, name, percent, bar, spent / limit.
 * `layout="grid"` is the half-width tile; list stays the full-width row.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { OnyxContainer } from '@/components/OnyxContainer';
import { AppIcon } from '@/components/icons/AppIcon';
import { ProgressBar } from '@/components/ProgressBar';
import {
  ONYX_CONTAINER,
  budgetCategoryGridFrameStyle,
  budgetCategoryRowFrameStyle,
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
  planFinanceKit,
} from '@/constants/planFinanceKit';
import { moneyAmountTypography, spacing, typographyKit } from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import type { BudgetCategoryUiModel } from '@/lib/budgetCategoryModel';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  category: BudgetCategoryUiModel;
  /** Multi-select manage mode (Agenda / Portefeuille pattern). */
  selecting?: boolean;
  selected?: boolean;
  onPress: (id: string) => void;
  /** `list` is the full-width row. `grid` is the half-width tile. */
  layout?: 'list' | 'grid';
};

const ICON_WELL = 36;
const ICON_GLYPH = 16;
const CHECK = 22;
/** Last resort when neither the stored icon nor the name matches a known category. */
const NEUTRAL_CATEGORY_EMOJI = '🏷️';

/** Icon-name and display-name keywords (folded, no accents) → grid emoji. */
const CATEGORY_EMOJI_RULES: readonly { keys: readonly string[]; emoji: string }[] = [
  { keys: ['appartement', 'maison', 'house', 'home', 'housing', 'rent', 'loyer', 'logement'], emoji: '🏠' },
  { keys: ['epicerie', 'grocery', 'groceries', 'shoppingbag', 'basket'], emoji: '🥕' },
  { keys: ['restaurant', 'restaurants', 'dining', 'utensils'], emoji: '🍽️' },
  { keys: ['gas', 'essence', 'fuel', 'gasoline', 'carburant'], emoji: '⛽' },
  { keys: ['electricite', 'electricity', 'utilities', 'bolt', 'flash', 'eclair'], emoji: '⚡' },
  { keys: ['telephone', 'phone', 'smartphone'], emoji: '📱' },
  { keys: ['transport', 'car', 'voiture'], emoji: '🚗' },
  { keys: ['loisirs', 'entertainment', 'gamepad'], emoji: '🎮' },
  { keys: ['vetements', 'clothes', 'clothing', 'shirt'], emoji: '👕' },
  { keys: ['sante', 'health', 'medkit', 'heartpulse'], emoji: '💊' },
  { keys: ['cafe', 'snacks', 'coffee'], emoji: '☕' },
];

function foldCategoryLabel(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function labelMatchesKey(folded: string, key: string): boolean {
  if (key.length <= 3) {
    return folded.split(/[^a-z0-9]+/).includes(key);
  }
  return folded.includes(key);
}

/** Grid tile emoji: stored emoji, else a match on icon name or category name. */
function categoryGridEmoji(icon: string | null | undefined, name: string | null | undefined): string {
  const stored = icon?.trim() ?? '';
  if (stored && !/^[A-Za-z0-9_-]+$/.test(stored) && /\p{Extended_Pictographic}/u.test(stored)) {
    return stored;
  }
  const haystack = foldCategoryLabel(`${stored} ${name ?? ''}`);
  for (const rule of CATEGORY_EMOJI_RULES) {
    if (rule.keys.some((key) => labelMatchesKey(haystack, key))) {
      return rule.emoji;
    }
  }
  return NEUTRAL_CATEGORY_EMOJI;
}

const amountStyle = moneyAmountTypography({ tier: 'row', fontSize: 12, lineHeight: 16 });

export const BudgetCategoryRow = memo(function BudgetCategoryRow({
  category,
  selecting = false,
  selected = false,
  onPress,
  layout = 'list',
}: Props) {
  const { colors, isLight } = useAppTheme();
  const compact = layout === 'grid';
  const over = category.usage.isOverBudget;
  const tone = over ? colors.danger : colors.accentGreen;
  const percentLabel = `${category.usage.usagePercent}%`;

  const glyph = selecting ? (
    <View
      style={[
        styles.checkWell,
        {
          backgroundColor: selected ? colors.text : 'transparent',
          borderColor: selected ? colors.text : colors.borderStrong,
        },
      ]}
    >
      {selected ? (
        <AppIcon family="ionicons" name="checkmark" size={14} color={colors.background} />
      ) : null}
    </View>
  ) : (
    <View style={styles.iconWell}>
      <BudgetCategoryIcon
        icon={category.icon}
        name={category.name}
        id={category.id}
        wellSize={ICON_WELL}
        glyphSize={ICON_GLYPH}
      />
    </View>
  );

  const spentLimit = (
    <View style={styles.spentLimit}>
      <Text
        style={[amountStyle, { color: colors.textSecondary }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {formatDisplayMoneyAbsolute(category.spent)}
      </Text>
      <Text style={[typographyKit.microMedium, { color: colors.textMuted }]}> / </Text>
      <Text
        style={[amountStyle, { color: colors.textSecondary }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {formatDisplayMoneyAbsolute(category.limit)}
      </Text>
    </View>
  );

  return (
    <Pressable
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { selected } : undefined}
      accessibilityLabel={`${category.name}, ${percentLabel}, ${formatDisplayMoneyAbsolute(category.spent)} sur ${formatDisplayMoneyAbsolute(category.limit)}${over ? ', dépassé' : ''}`}
      onPress={() => {
        tapHaptic();
        onPress(category.id);
      }}
      style={({ pressed }) => [
        compact ? budgetCategoryGridFrameStyle() : budgetCategoryRowFrameStyle(),
        pressed && onyxContainerPressedStyle(),
      ]}
    >
      <OnyxContainer
        halo={false}
        style={[
          compact ? styles.gridCard : onyxContainerRowLayoutStyle(),
          compact ? budgetCategoryGridFrameStyle() : budgetCategoryRowFrameStyle(),
          !isLight && { backgroundColor: colors.modalSurface },
          selected && { borderColor: colors.accentGreen },
        ]}
      >
        {compact ? (
          <>
            <View style={styles.gridNameRow}>
              {selecting ? (
                glyph
              ) : (
                <Text style={styles.gridEmoji} numberOfLines={1}>
                  {categoryGridEmoji(category.icon, category.name)}
                </Text>
              )}
              <Text
                style={[typographyKit.rowTitle, styles.gridName, { color: colors.text }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {category.name}
              </Text>
            </View>
            <Text
              style={[typographyKit.metaSemibold, { color: tone }]}
              numberOfLines={1}
            >
              {percentLabel}
            </Text>
            <ProgressBar
              progress={category.usage.progress}
              color={tone}
              trackColor={colors.borderSubtle}
              height={5}
            />
            <Text
              style={[amountStyle, styles.gridAmount, { color: colors.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {formatDisplayMoneyAbsolute(category.spent)}
              <Text style={{ color: colors.textMuted }}>
                {` / ${formatDisplayMoneyAbsolute(category.limit)}`}
              </Text>
            </Text>
          </>
        ) : (
          <>
            {glyph}
            <View style={styles.body}>
              <View style={styles.nameRow}>
                <Text
                  style={[typographyKit.rowTitle, styles.name, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {category.name}
                </Text>
                <Text style={[typographyKit.metaSemibold, { color: tone }]}>{percentLabel}</Text>
              </View>
              <ProgressBar
                progress={category.usage.progress}
                color={tone}
                trackColor={colors.borderSubtle}
                height={5}
              />
              {spentLimit}
            </View>
          </>
        )}
      </OnyxContainer>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  gridCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    width: '100%',
    gap: spacing.sm,
    padding: ONYX_CONTAINER.padding.row,
  },
  gridNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    gap: spacing.xs,
  },
  gridEmoji: {
    fontSize: 14,
    lineHeight: 18,
    flexShrink: 0,
  },
  /** Grow into the row. No flex:1 / minWidth:0 — that basis is 0 and wraps one letter per line. */
  gridName: {
    flexGrow: 1,
    flexShrink: 1,
  },
  gridAmount: {
    alignSelf: 'stretch',
  },
  iconWell: {
    width: ICON_WELL,
    height: ICON_WELL,
    borderRadius: planFinanceKit.radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkWell: {
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    minWidth: 0,
  },
  spentLimit: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 1,
    minWidth: 0,
  },
});
