import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { interMediumText, interSemiboldText, radius, spacing } from '@/constants/theme';
import {
  UNIFORM_CHIP_FONT_SIZE,
  UNIFORM_SEGMENT_HEIGHT,
  UNIFORM_SEGMENT_INNER_HEIGHT,
} from '@/lib/uniformGroupStyles';
import { useAppTheme } from '@/lib/themeContext';

/** Shared by every segment label — same base size + auto-shrink scale. */
const SEGMENT_LABEL_FONT_SIZE = UNIFORM_CHIP_FONT_SIZE;
const SEGMENT_LABEL_MIN_FONT_SCALE = 0.72;

const segmentLabelBaseStyle = {
  ...interMediumText,
  fontSize: SEGMENT_LABEL_FONT_SIZE,
  lineHeight: SEGMENT_LABEL_FONT_SIZE + 3,
  textAlign: 'center' as const,
  includeFontPadding: true,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.35,
};

type Tab<T extends string> = { id: T; label: string; icon?: keyof typeof Ionicons.glyphMap };

type Props<T extends string> = {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
  showDivider?: boolean;
};

export function SegmentedTabs<T extends string>({
  tabs,
  active,
  onChange,
  showDivider = true,
}: Props<T>) {
  const { colors, isLight } = useAppTheme();
  const inactivePillBackground = isLight ? colors.input : '#0A0A0A';
  const activePillBackground = isLight ? 'rgba(0, 168, 84, 0.14)' : '#1C2128';
  const activeTextColor = colors.text;

  const trackBackground = isLight ? 'transparent' : colors.background;

  return (
    <View style={[styles.wrap, showDivider && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
      <View style={[styles.row, { backgroundColor: trackBackground }]}>
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <Pressable key={tab.id} onPress={() => onChange(tab.id)} style={styles.tab}>
              <MotiView
                animate={{
                  scale: selected ? 1 : 0.98,
                  opacity: selected ? 1 : 0.86,
                }}
                transition={{ type: 'timing', duration: 180 }}
                style={[
                  styles.glassPill,
                  { backgroundColor: inactivePillBackground },
                  selected && [
                    styles.glassPillActive,
                    {
                      backgroundColor: activePillBackground,
                      borderColor: colors.borderStrong,
                    },
                  ],
                ]}
              >
                <View style={styles.labelRow}>
                  {tab.icon ? (
                    <Ionicons name={tab.icon} size={14} color={selected ? activeTextColor : colors.textMuted} />
                  ) : null}
                  <Text
                    style={[
                      styles.label,
                      segmentLabelBaseStyle,
                      { color: selected ? activeTextColor : colors.textMuted },
                      selected && styles.labelActive,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={SEGMENT_LABEL_MIN_FONT_SCALE}
                  >
                    {tab.label}
                  </Text>
                </View>
              </MotiView>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    width: '100%',
    minHeight: UNIFORM_SEGMENT_HEIGHT,
  },
  tab: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'stretch',
    paddingHorizontal: spacing.xs / 2,
    minWidth: 0,
  },
  glassPill: {
    flex: 1,
    width: '100%',
    minHeight: UNIFORM_SEGMENT_INNER_HEIGHT,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  glassPillActive: {},
  labelRow: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minWidth: 0,
  },
  label: {
    width: '100%',
    minWidth: 0,
    flexShrink: 1,
  },
  labelActive: { ...interSemiboldText },
});
