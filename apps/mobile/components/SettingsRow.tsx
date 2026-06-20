import { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  interMediumText,
  interSemiboldText,
  spacing,
  typography,
  typographyKit,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { UNIFORM_ROW_MIN_HEIGHT } from '@/lib/uniformGroupStyles';
import { noMidWordClipTextProps, singleLineLabelStyle } from '@/lib/textLayout';

type BaseProps = {
  label: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isLast?: boolean;
  destructive?: boolean;
};

type NavigationProps = BaseProps & {
  value?: string;
  onPress: () => void;
  accessory?: ReactNode;
};

type ToggleProps = BaseProps & {
  value: boolean;
  onValueChange: (enabled: boolean) => void;
  accessibilityLabel?: string;
};

type CustomProps = BaseProps & {
  children: ReactNode;
};

function RowShell({
  children,
  isLast,
  onPress,
  accessibilityLabel,
  alignItems = 'center',
}: {
  children: ReactNode;
  isLast?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  alignItems?: 'center' | 'flex-start';
}) {
  const { colors } = useAppTheme();

  const content = (
    <View
      style={[
        styles.row,
        { alignItems },
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? undefined}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

function RowCopy({
  label,
  hint,
  icon,
  destructive,
}: Pick<BaseProps, 'label' | 'hint' | 'icon' | 'destructive'>) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.copy}>
      {icon ? (
        <View style={[styles.iconWell, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons
            name={icon}
            size={17}
            color={destructive ? colors.danger : colors.textSecondary}
          />
        </View>
      ) : null}
      <View style={styles.textBlock}>
        <Text
          style={[
            styles.label,
            singleLineLabelStyle,
            { color: destructive ? colors.danger : colors.text },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {label}
        </Text>
        {hint ? (
          <Text style={[styles.hint, { color: colors.textMuted }]} numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function SettingsNavigationRow({
  label,
  hint,
  icon,
  value,
  onPress,
  isLast,
  destructive,
  accessory,
}: NavigationProps) {
  const { colors } = useAppTheme();

  return (
    <RowShell
      onPress={onPress}
      accessibilityLabel={label}
      isLast={isLast}
    >
      <RowCopy label={label} hint={hint} icon={icon} destructive={destructive} />
      <View style={styles.trailing}>
        {value ? (
          <Text
            style={[styles.value, { color: colors.textMuted }]}
            {...noMidWordClipTextProps()}
          >
            {value}
          </Text>
        ) : null}
        {accessory ?? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
      </View>
    </RowShell>
  );
}

export function SettingsToggleRow({
  label,
  hint,
  icon,
  value,
  onValueChange,
  isLast,
  accessibilityLabel,
}: ToggleProps) {
  const { colors } = useAppTheme();

  return (
    <RowShell isLast={isLast}>
      <RowCopy label={label} hint={hint} icon={icon} />
      <Switch
        accessibilityLabel={accessibilityLabel ?? label}
        value={value}
        onValueChange={(enabled) => {
          tapHaptic();
          onValueChange(enabled);
        }}
        trackColor={{ false: colors.borderStrong, true: colors.primary }}
        thumbColor={value ? colors.surfaceSolid : undefined}
        ios_backgroundColor={colors.borderStrong}
      />
    </RowShell>
  );
}

export function SettingsCustomRow({ label, hint, icon, isLast, children }: CustomProps) {
  return (
    <RowShell isLast={isLast}>
      <View style={styles.customBlock}>
        <RowCopy label={label} hint={hint} icon={icon} />
        <View style={styles.customAccessory}>{children}</View>
      </View>
    </RowShell>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: UNIFORM_ROW_MIN_HEIGHT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.82,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    ...interSemiboldText,
    fontSize: typography.body,
  },
  hint: {
    ...interMediumText,
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
    minWidth: 0,
  },
  value: {
    ...typographyKit.metaMedium,
    ...singleLineLabelStyle,
    textAlign: 'right',
    lineHeight: typographyKit.metaMedium.fontSize + 4,
  },
  customBlock: {
    flex: 1,
    minWidth: 0,
    gap: spacing.md,
  },
  customAccessory: {
    alignSelf: 'stretch',
  },
});
