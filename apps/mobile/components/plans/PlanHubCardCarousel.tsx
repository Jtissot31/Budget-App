import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { PlanCard } from '@/components/plans/PlanCard';
import { PAGE_PADDING_HORIZONTAL, spacing } from '@/constants/theme';
import type { PlanActifOuTermine } from '@/lib/plans/Plan';

const CARD_GAP = spacing.md;
/** Fraction of content width per card when multiple plans — leaves a peek of the next card. */
const MULTI_CARD_WIDTH_RATIO = 0.88;

type Props = {
  plans: PlanActifOuTermine[];
  onOpenPlan: (planId: string) => void;
};

export function PlanHubCardCarousel({ plans, onOpenPlan }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const contentWidth = screenWidth - PAGE_PADDING_HORIZONTAL * 2;
  const isSingle = plans.length <= 1;
  const cardWidth = isSingle ? contentWidth : contentWidth * MULTI_CARD_WIDTH_RATIO;
  const snapInterval = cardWidth + CARD_GAP;
  const listViewportWidth = screenWidth - PAGE_PADDING_HORIZONTAL;
  const trailingPadding = isSingle ? 0 : listViewportWidth - cardWidth;

  if (isSingle) {
    const plan = plans[0];
    return (
      <View style={styles.singleWrap}>
        <PlanCard plan={plan} onPress={() => onOpenPlan(plan.id)} style={{ width: cardWidth }} />
      </View>
    );
  }

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
            onPress={() => onOpenPlan(item.id)}
            style={{
              width: cardWidth,
              marginRight: index < plans.length - 1 ? CARD_GAP : 0,
            }}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  singleWrap: {
    alignSelf: 'stretch',
  },
  carouselBleed: {
    marginRight: -PAGE_PADDING_HORIZONTAL,
  },
});
