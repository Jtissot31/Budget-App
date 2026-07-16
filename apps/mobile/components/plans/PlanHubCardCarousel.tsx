import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PlanCard } from '@/components/plans/PlanCard';
import { planFinanceKit } from '@/constants/planFinanceKit';
import { PAGE_PADDING_HORIZONTAL } from '@/constants/theme';
import type { Plan } from '@/lib/plans/Plan';
import { PLAN_CAROUSEL } from '@/lib/plans/planCardPresentation';

const CARD_GAP = PLAN_CAROUSEL.cardGap;
const CARD_WIDTH = PLAN_CAROUSEL.cardWidth;
const EDGE_FADE_WIDTH = PLAN_CAROUSEL.edgeFadeWidth;

type Props = {
  plans: Plan[];
  onOpenPlan: (planId: string) => void;
};

export function PlanHubCardCarousel({ plans, onOpenPlan }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const snapInterval = CARD_WIDTH + CARD_GAP;
  const listViewportWidth = screenWidth - PAGE_PADDING_HORIZONTAL;
  const trailingPadding = Math.max(listViewportWidth - CARD_WIDTH, EDGE_FADE_WIDTH);
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
            style={index < plans.length - 1 ? { marginRight: CARD_GAP } : undefined}
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
