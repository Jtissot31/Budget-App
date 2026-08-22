import { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { PremiumSwitch } from '@/components/PremiumSwitch';
import {
  jakartaMediumText,
  jakartaSemiboldText,
  SETTINGS_LAYOUT,
  spacing,
  typography,
  typographyKit,
} from '@/constants/theme';
import { pressableRowMotionStyle } from '@/constants/motionKit';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { UNIFORM_ROW_MIN_HEIGHT } from '@/lib/uniformGroupStyles';
import {
  noMidWordClipTextProps,
  singleLineLabelStyle,
} from '@/lib/textLayout';

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
      style={({ pressed }) => [pressableRowMotionStyle(pressed), styles.pressable]}
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
        <View
          style={[
            styles.iconWell,
            { backgroundColor: colors.surfaceElevated },
          ]}
        >
          <AppIcon
            family="ionicons"
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
          <Text
            style={[styles.hint, singleLineLabelStyle, { color: colors.textMuted }]}
            numberOfLines={3}
            ellipsizeMode="tail"
          >
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
            {...noMidWordClipTextProps({ minScale: 0.7, singleLine: true })}
          >
            {value}
          </Text>
        ) : null}
        {accessory ? (
          <View style={styles.accessorySlot}>{accessory}</View>
        ) : (
          <AppIcon family="ionicons" name="chevron-forward" size={18} color={colors.textMuted} />
        )}
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
  return (
    <RowShell isLast={isLast}>
      <RowCopy label={label} hint={hint} icon={icon} />
      <View style={styles.toggleSlot}>
        <PremiumSwitch
          accessibilityLabel={accessibilityLabel ?? label}
          value={value}
          onValueChange={(enabled) => {
            tapHaptic();
            onValueChange(enabled);
          }}
        />
      </View>
    </RowShell>
  );
}

export function SettingsCustomRow({ label, hint, icon, isLast, children }: CustomProps) {
  return (
    <RowShell isLast={isLast} alignItems="flex-start">
      <View style={styles.customBlock}>
        <RowCopy label={label} hint={hint} icon={icon} />
        <View style={styles.customAccessory}>{children}</View>
      </View>
    </RowShell>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SETTINGS_LAYOUT.rowGap,
    minHeight: UNIFORM_ROW_MIN_HEIGHT,
    paddingHorizontal: SETTINGS_LAYOUT.rowPaddingH,
    paddingVertical: SETTINGS_LAYOUT.rowPaddingV,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SETTINGS_LAYOUT.rowGap,
  },
  iconWell: {
    width: SETTINGS_LAYOUT.iconWellSize,
    height: SETTINGS_LAYOUT.iconWellSize,
    borderRadius: SETTINGS_LAYOUT.iconWellSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    gap: 2,
  },
  label: {
    ...jakartaSemiboldText,
    fontSize: typography.body,
  },
  hint: {
    ...jakartaMediumText,
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: SETTINGS_LAYOUT.trailingMaxWidth,
  },
  value: {
    ...typographyKit.metaMedium,
    ...singleLineLabelStyle,
    textAlign: 'right',
    lineHeight: typographyKit.metaMedium.fontSize + 4,
  },
  accessorySlot: {
    flexShrink: 0,
  },
  toggleSlot: {
    flexShrink: 0,
  },
  customBlock: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    gap: SETTINGS_LAYOUT.customControlGap,
  },
  customAccessory: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
});
