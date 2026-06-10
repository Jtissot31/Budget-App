import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  interBoldText,
  interExtraBoldText,
  radius,
  spacing,
} from '@/constants/theme';
import {
  UNIFORM_CHIP_FONT_SIZE,
  UNIFORM_SEGMENT_HEIGHT,
  UNIFORM_SEGMENT_INNER_HEIGHT,
} from '@/lib/uniformGroupStyles';
import { chipLabelTextProps, singleLineLabelStyle } from '@/lib/textLayout';
import { useAppTheme } from '@/lib/themeContext';

type Tab<T extends string> = { id: T; label: string; icon?: keyof typeof Ionicons.glyphMap };

type Props<T extends string> = {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
  showDivider?: boolean;
  /** Override track background color */
  trackBgColor?: string;
  /** Override active pill background color */
  activeBgColor?: string;
  /** Override active label color */
  activeLabelColor?: string;
  /** Override inactive label color */
  inactiveLabelColor?: string;
};

/** Matches Portefeuille Comptes / Patrimoine scope track styling. */
export function SegmentedTabs<T extends string>({
  tabs,
  active,
  onChange,
  showDivider = true,
  trackBgColor,
  activeBgColor,
  activeLabelColor,
  inactiveLabelColor,
}: Props<T>) {
  const { colors } = useAppTheme();
  const trackBg = trackBgColor ?? colors.segmentedTabTrack;
  const activeBg = activeBgColor ?? colors.segmentedTabActivePill;
  const activeColor = activeLabelColor ?? colors.segmentedTabActiveText;
  const inactiveColor = inactiveLabelColor ?? colors.segmentedTabInactiveText;

  return (
    <View style={[styles.wrap, showDivider && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
      <View style={[styles.track, { backgroundColor: trackBg }]}>
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(tab.id)}
              style={[styles.tab, selected && { backgroundColor: activeBg }]}
            >
              <View style={styles.labelRow}>
                {tab.icon ? (
                  <Ionicons name={tab.icon} size={14} color={selected ? activeColor : inactiveColor} />
                ) : null}
                <Text
                  style={[
                    styles.label,
                    singleLineLabelStyle,
                    { color: selected ? activeColor : inactiveColor, fontSize: UNIFORM_CHIP_FONT_SIZE },
                    selected && styles.labelActive,
                  ]}
                  {...chipLabelTextProps({ minScale: 0.72 })}
                >
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    width: '100%',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    width: '100%',
    borderRadius: radius.xxl,
    padding: 4,
    gap: 4,
    minHeight: UNIFORM_SEGMENT_HEIGHT,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xxl - 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: UNIFORM_SEGMENT_INNER_HEIGHT,
  },
  labelRow: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minWidth: 0,
  },
  label: {
    ...interBoldText,
    textAlign: 'center',
    lineHeight: UNIFORM_CHIP_FONT_SIZE + 4,
    width: '100%',
    minWidth: 0,
    flexShrink: 1,
  },
  labelActive: {
    ...interExtraBoldText,
  },
});
