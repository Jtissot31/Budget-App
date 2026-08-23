import { StyleSheet, Text, View } from 'react-native';
import { FynAvatar } from '@/components/ai-chat/FynAvatar';
import { PAGE_PADDING_HORIZONTAL, spacing, typographyKit } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';
import { useAIChatColors } from './theme';
import { AIChatQuickChips } from './AIChatQuickChips';
import type { AIQuickChip } from './types';

type Props = {
  chips: readonly AIQuickChip[];
  onChipPress: (message: string) => void;
  disabled?: boolean;
};

export function AIChatEmptyState({ chips, onChipPress, disabled = false }: Props) {
  const palette = useAIChatColors();
  const { colors } = useAppTheme();

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <FynAvatar size={56} showStatus statusBorderColor={palette.background} />
        <Text style={[styles.greeting, { color: palette.text }, typographyKit.sectionTitle]}>
          Comment puis-je vous aider ?
        </Text>
        <Text style={[styles.subtitle, { color: palette.textMuted }, typographyKit.body]}>
          Je suis Fyn, votre assistant financier — budgets, plans et conseils personnalisés.
        </Text>
      </View>

      <View style={styles.prompts}>
        <Text style={[styles.promptsLabel, { color: colors.textMuted }, typographyKit.eyebrow]}>
          SUGGESTIONS
        </Text>
        <AIChatQuickChips
          chips={chips}
          onChipPress={onChipPress}
          disabled={disabled}
          variant="cards"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    paddingBottom: spacing.xl,
    gap: spacing.xxl,
    minHeight: 320,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  greeting: {
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 22,
  },
  prompts: {
    width: '100%',
    gap: spacing.sm,
  },
  promptsLabel: {
    letterSpacing: 0.6,
    paddingHorizontal: spacing.xs,
  },
});
