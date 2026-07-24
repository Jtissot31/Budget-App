import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { OnyxContainer } from '@/components/OnyxContainer';
import {
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import { typographyKit } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  onPress: () => void;
};

const LABEL = 'Galerie widgets';
const SUBTITLE = "Raccourcis Fyn sur l'accueil";

export function WidgetGalleryShortcutRow({ onPress }: Props) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ouvrir la galerie widgets Fyn"
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
    >
      <OnyxContainer style={styles.row}>
        <View style={[styles.iconWell, { backgroundColor: colors.input }]}>
          <AppIcon
            family="material-community"
            name="view-grid-outline"
            size={18}
            color={colors.accentGreen || colors.primary}
          />
        </View>
        <View style={styles.copy}>
          <Text style={[typographyKit.rowTitle, { color: colors.text }]} numberOfLines={1}>
            {LABEL}
          </Text>
          <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]} numberOfLines={1}>
            {SUBTITLE}
          </Text>
        </View>
        <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
      </OnyxContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    ...onyxContainerRowLayoutStyle(),
    minHeight: 56,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
