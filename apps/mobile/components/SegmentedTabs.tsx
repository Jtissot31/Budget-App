import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, typography } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Tab<T extends string> = { id: T; label: string; icon?: keyof typeof Ionicons.glyphMap };

type Props<T extends string> = {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
  showDivider?: boolean;
};

export function SegmentedTabs<T extends string>({ tabs, active, onChange, showDivider = true }: Props<T>) {
  const { colors, isLight } = useAppTheme();
  const activePillBackground = isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.10)';
  const activeTextColor = colors.text;

  return (
    <View style={[styles.wrap, showDivider && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
      <View style={styles.row}>
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
                      { color: selected ? activeTextColor : colors.textMuted },
                      selected && styles.labelActive,
                    ]}
                    numberOfLines={1}
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
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    width: '100%',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    minWidth: 0,
  },
  glassPill: {
    width: '100%',
    minHeight: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
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
    fontSize: typography.micro,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: typography.micro + 4,
    includeFontPadding: true,
    flexShrink: 1,
  },
  labelActive: { fontWeight: '800' },
});
