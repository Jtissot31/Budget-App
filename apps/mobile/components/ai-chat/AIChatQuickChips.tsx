import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { SwipeBackExclusion } from '@/components/gestures/SwipeBackExclusion';
import { OnyxContainer } from '@/components/OnyxContainer';
import {
  ONYX_CONTAINER,
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import { jakartaMediumText, PAGE_PADDING_HORIZONTAL, spacing, typographyKit } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { useAIChatColors } from './theme';
import type { AIQuickChip } from './types';

type Props = {
  chips: readonly AIQuickChip[];
  onChipPress: (message: string) => void;
  disabled?: boolean;
  /** `cards` — Claude-style prompt rows; `pills` — legacy horizontal chips */
  variant?: 'cards' | 'pills';
};

function ChipIcon({
  icon,
  accentColor,
  surfaceColor,
}: {
  icon: NonNullable<AIQuickChip['icon']>;
  accentColor: string;
  surfaceColor: string;
}) {
  return (
    <View style={[styles.iconBadge, { backgroundColor: surfaceColor }]}>
      <AppIcon
        family={icon.family}
        name={icon.name}
        size={20}
        color={accentColor}
      />
    </View>
  );
}

export function AIChatQuickChips({
  chips,
  onChipPress,
  disabled = false,
  variant = 'pills',
}: Props) {
  const palette = useAIChatColors();
  const { colors } = useAppTheme();

  if (variant === 'cards') {
    return (
      <View style={styles.cardsStack}>
        {chips.map((chip) => (
          <Pressable
            key={chip.label}
            accessibilityRole="button"
            accessibilityLabel={chip.message}
            disabled={disabled}
            onPress={() => {
              tapHaptic();
              onChipPress(chip.message);
            }}
            style={({ pressed }) => [pressed && onyxContainerPressedStyle(), disabled && styles.disabled]}
          >
            <OnyxContainer style={[onyxContainerRowLayoutStyle(), styles.cardRow]}>
              {chip.icon ? (
                <ChipIcon
                  icon={chip.icon}
                  accentColor={colors.accentGreen ?? palette.primary}
                  surfaceColor={colors.containerBackground}
                />
              ) : null}
              <View style={styles.cardCopy}>
                <Text
                  style={[styles.cardTitle, { color: palette.text }, typographyKit.rowTitle]}
                  numberOfLines={2}
                >
                  {chip.label}
                </Text>
                {chip.hint ? (
                  <Text
                    style={[styles.cardHint, { color: palette.textMuted }, typographyKit.metaMedium]}
                    numberOfLines={2}
                  >
                    {chip.hint}
                  </Text>
                ) : null}
              </View>
              <AppIcon
                family="ionicons"
                name="arrow-forward"
                size={16}
                color={palette.textMuted}
              />
            </OnyxContainer>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <SwipeBackExclusion>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillsContainer}
        contentContainerStyle={styles.pillsContent}
        keyboardShouldPersistTaps="handled"
      >
        {chips.map((chip) => (
          <Pressable
            key={chip.label}
            accessibilityRole="button"
            accessibilityLabel={chip.message}
            disabled={disabled}
            onPress={() => {
              tapHaptic();
              onChipPress(chip.message);
            }}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Text style={[styles.pillText, { color: palette.text }, jakartaMediumText]} numberOfLines={1}>
              {chip.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </SwipeBackExclusion>
  );
}

const styles = StyleSheet.create({
  cardsStack: {
    gap: ONYX_CONTAINER.listGap,
  },
  cardRow: {
    minHeight: 64,
    alignItems: 'center',
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  cardHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  pillsContainer: {
    maxHeight: 50,
    marginBottom: spacing.sm,
    flexGrow: 0,
  },
  pillsContent: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: spacing.sm,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.5,
  },
});
