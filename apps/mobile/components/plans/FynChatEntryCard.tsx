import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { useRouter } from 'expo-router';
import { FynAvatar } from '@/components/ai-chat/FynAvatar';
import { OnyxContainer } from '@/components/OnyxContainer';
import {
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import { typographyKit } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

export function FynChatEntryCard() {
  const router = useRouter();
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ouvrir le conseiller Fyn"
      onPress={() => {
        tapHaptic();
        router.push('/fyn-chat');
      }}
      style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
    >
      <OnyxContainer style={styles.row}>
        <FynAvatar size={40} showStatus statusBorderColor={colors.containerBackground} />
        <View style={styles.copy}>
          <Text
            style={[typographyKit.rowTitle, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Parler à Fyn
          </Text>
          <Text
            style={[typographyKit.metaMedium, { color: colors.textMuted }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Conseiller IA pour tes plans
          </Text>
        </View>
        <AppIcon
          family="ionicons"
          name="chevron-forward"
          size={16}
          color={colors.accentGreen || colors.primary}
        />
      </OnyxContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    ...onyxContainerRowLayoutStyle(),
    minHeight: 56,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
