// Budget categories: clean slate — rebuild structure/logic here (no legacy donut/hit-test).
import { useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetShortcutCards } from '@/components/budget/BudgetShortcutCards';
import { PageTransition } from '@/components/PageTransition';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  FLOATING_NAV_CONTENT_PADDING,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_STYLE,
  PORTFOLIO_SECTION_GAP,
  spacing,
} from '@/constants/theme';
import { useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';

function BudgetPageHeader() {
  const { colors } = useAppTheme();

  return (
    <View style={pageStyles.heroBlock}>
      <View style={pageStyles.headerRow}>
        <Text style={[pageStyles.pageTitle, { color: colors.text }]} numberOfLines={1}>
          Budget
        </Text>
      </View>
    </View>
  );
}

export default function BudgetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);

  useScrollToTopOnFocus(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={['rgba(0,230,100,0.055)', 'transparent']}
          style={pageStyles.ambientGlow}
          pointerEvents="none"
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <ScrollView
          ref={scrollRef}
          style={styles.screen}
          contentContainerStyle={[
            pageStyles.content,
            {
              paddingTop: insets.top + SCREEN_TOP_GUTTER,
              paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.xl,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <BudgetPageHeader />
          <BudgetShortcutCards
            onPressPlans={() => router.push('/(tabs)/goals')}
            onPressSavingsGoals={() => router.push('/savings-goals')}
          />
        </ScrollView>
      </View>
    </PageTransition>
  );
}

const pageStyles = StyleSheet.create({
  ambientGlow: {
    position: 'absolute',
    top: -100,
    alignSelf: 'center',
    width: 420,
    height: 260,
    zIndex: 0,
  },
  content: {
    gap: PORTFOLIO_SECTION_GAP,
  },
  heroBlock: {
    alignItems: 'flex-start',
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  headerRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  pageTitle: { ...PAGE_TITLE_STYLE, flex: 1, minWidth: 0 },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
