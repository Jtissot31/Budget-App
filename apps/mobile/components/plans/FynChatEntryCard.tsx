import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type RefObject, type ScrollView } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { useRouter } from 'expo-router';
import { FynAvatar } from '@/components/ai-chat/FynAvatar';
import { OnyxContainer } from '@/components/OnyxContainer';
import {
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import { typographyKit } from '@/constants/theme';
import { useAppTourTarget } from '@/hooks/useAppTourTarget';
import { registerAppTourRevealer } from '@/lib/appTourTargets';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  /** Parent hub scroll — tour scrolls to end so this card is visible. */
  scrollRef?: RefObject<ScrollView | null>;
};

export function FynChatEntryCard({ scrollRef }: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const tourRef = useAppTourTarget('fyn-entry');

  useEffect(() => {
    return registerAppTourRevealer('fyn-entry', () => {
      scrollRef?.current?.scrollToEnd({ animated: true });
    });
  }, [scrollRef]);

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
      <View ref={tourRef} collapsable={false}>
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
      </View>
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
