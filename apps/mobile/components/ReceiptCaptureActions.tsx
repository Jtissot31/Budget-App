import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { OnyxContainer } from '@/components/OnyxContainer';
import {
  ONYX_CONTAINER,
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import { spacing } from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  onImport: () => void;
  onCapture: () => void;
};

export function ReceiptCaptureActions({ onImport, onCapture }: Props) {
  const { colors } = useAppTheme();

  const actions = [
    {
      key: 'camera',
      icon: 'camera-outline' as const,
      label: 'Caméra',
      hint: 'Prendre une photo',
      onPress: onCapture,
    },
    {
      key: 'gallery',
      icon: 'image-outline' as const,
      label: 'Galerie',
      hint: 'Choisir une image',
      onPress: onImport,
    },
  ];

  return (
    <View style={styles.stack}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={() => {
            tapHaptic();
            action.onPress();
          }}
          style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
        >
          <OnyxContainer style={[onyxContainerRowLayoutStyle(), styles.actionInner]}>
            <View style={[styles.iconWell, { backgroundColor: colors.input }]}>
              <AppIcon family="ionicons" name={action.icon} size={24} color={colors.text} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.label, { color: colors.text }]}>{action.label}</Text>
              <Text style={[styles.hint, { color: colors.textMuted }]}>{action.hint}</Text>
            </View>
            <AppIcon family="ionicons" name="chevron-forward" size={18} color={colors.textMuted} />
          </OnyxContainer>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: ONYX_CONTAINER.listGap,
  },
  actionInner: {
    minHeight: 72,
    paddingVertical: spacing.md + 2,
  },
  iconWell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    ...typographyKit.sectionTitle,
    fontSize: 17,
  },
  hint: {
    ...typographyKit.metaMedium,
  },
});
