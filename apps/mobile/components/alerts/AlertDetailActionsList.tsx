import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { OnyxContainer } from '@/components/OnyxContainer';
import { ProtoSectionHeader } from '@/components/proto/ProtoSectionHeader';
import {
  ONYX_CONTAINER,
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
  planFinanceKit,
} from '@/constants/planFinanceKit';
import { typographyKit } from '@/constants/theme';
import { alertSolutionOptionIcon, type AlertSolution } from '@/lib/alertPresentation';
import { resolveUserPickedIconWellBackground } from '@/lib/userPickedIcon';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  label: string;
  solutions: AlertSolution[];
  onPressSolution: (solution: AlertSolution) => void;
};

/**
 * Shared alert-detail choices — compact Onyx rows with distinct option icons (not a sequence).
 */
export function AlertDetailActionsList({ label, solutions, onPressSolution }: Props) {
  const { colors, isLight } = useAppTheme();
  const optionWellBg = resolveUserPickedIconWellBackground(isLight);

  return (
    <View style={styles.section}>
      <ProtoSectionHeader title={label.toUpperCase()} />
      <View style={styles.list}>
        {solutions.map((solution) => {
          const optionIcon = alertSolutionOptionIcon(solution);

          return (
            <Pressable
              key={solution.id}
              accessibilityRole="button"
              accessibilityLabel={solution.ctaLabel}
              onPress={() => onPressSolution(solution)}
              style={({ pressed }) => [styles.item, pressed && onyxContainerPressedStyle()]}
            >
              <OnyxContainer style={[onyxContainerRowLayoutStyle(), styles.rowTighten]}>
                <View style={[styles.optionWell, { backgroundColor: optionWellBg }]}>
                  <AppIcon
                    family={optionIcon.family}
                    name={optionIcon.name}
                    size={16}
                    color={colors.text}
                  />
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                    {solution.title}
                  </Text>
                  <Text style={[styles.body, { color: colors.textMuted }]} numberOfLines={1}>
                    {solution.description}
                  </Text>
                </View>
                <AppIcon
                  family="ionicons"
                  name="chevron-forward"
                  size={16}
                  color={colors.accentGreen}
                />
              </OnyxContainer>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    alignSelf: 'stretch',
  },
  list: {
    gap: ONYX_CONTAINER.listGap,
  },
  item: {
    alignSelf: 'stretch',
  },
  rowTighten: {
    paddingVertical: ONYX_CONTAINER.padding.row - 2,
  },
  optionWell: {
    width: 32,
    height: 32,
    borderRadius: planFinanceKit.radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    ...typographyKit.rowTitle,
  },
  body: {
    ...typographyKit.microMedium,
  },
});
