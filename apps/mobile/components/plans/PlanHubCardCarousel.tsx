import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PlanCard } from '@/components/plans/PlanCard';
import { planFinanceKit } from '@/constants/planFinanceKit';
import { PAGE_PADDING_HORIZONTAL, spacing } from '@/constants/theme';
import type { Plan } from '@/lib/plans/Plan';

const CARD_GAP = spacing.md;
/** Shorter than content so the next card peeks under the edge fade. */
const CARD_WIDTH_RATIO = 0.68;
const EDGE_FADE_WIDTH = 56;

type Props = {
  plans: Plan[];
  onOpenPlan: (planId: string) => void;
};

export function PlanHubCardCarousel({ plans, onOpenPlan }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const contentWidth = screenWidth - PAGE_PADDING_HORIZONTAL * 2;
  const cardWidth = contentWidth * CARD_WIDTH_RATIO;
  const snapInterval = cardWidth + CARD_GAP;
  const listViewportWidth = screenWidth - PAGE_PADDING_HORIZONTAL;
  const trailingPadding = Math.max(listViewportWidth - cardWidth, EDGE_FADE_WIDTH);
  const canvas = planFinanceKit.colors.background;
  const showFade = plans.length > 0;

  return (
    <View style={styles.carouselBleed}>
      <FlatList
        data={plans}
        horizontal
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        nestedScrollEnabled
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingRight: trailingPadding }}
        getItemLayout={(_, index) => ({
          length: snapInterval,
          offset: snapInterval * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <PlanCard
            plan={item}
            suggested={item.statut === 'suggere'}
            layout="carousel"
            onPress={() => onOpenPlan(item.id)}
            style={{
              width: cardWidth,
              marginRight: index < plans.length - 1 ? CARD_GAP : 0,
            }}
          />
        )}
      />

      {showFade ? (
        <LinearGradient
          pointerEvents="none"
          colors={[`${canvas}00`, canvas]}
          locations={[0, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.edgeFade}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carouselBleed: {
    position: 'relative',
    marginRight: -PAGE_PADDING_HORIZONTAL,
  },
  edgeFade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: EDGE_FADE_WIDTH,
    zIndex: 2,
  },
});
