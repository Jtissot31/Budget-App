/**
 * Onde animée de l'état « J'écoute… ».
 *
 * Les barres bouclent en continu (retour visible même si le métering n'est pas
 * remonté par la plateforme) et l'amplitude globale suit le niveau réel du micro.
 */

import { MotiView } from 'moti';
import { StyleSheet, View } from 'react-native';

/** Hauteurs de repos, du plus court au plus haut au centre. */
const BAR_HEIGHTS = [16, 28, 40, 28, 16];
const BAR_WIDTH = 6;
const BAR_GAP = 7;
/** Hauteur de référence de l'onde — sert d'échelle pour `size`. */
const BASE_HEIGHT = 48;

type Props = {
  /** Niveau micro normalisé 0..1. */
  level: number;
  color: string;
  /** Hauteur totale de l'onde (défaut 48) — barres et espacement suivent. */
  size?: number;
};

export function VoiceListeningWave({ level, color, size = BASE_HEIGHT }: Props) {
  const amplitude = 0.55 + Math.min(1, Math.max(0, level)) * 0.45;
  const scale = size / BASE_HEIGHT;
  const barWidth = Math.max(3, Math.round(BAR_WIDTH * scale));

  return (
    <View
      style={[styles.row, { height: size, gap: Math.max(4, Math.round(BAR_GAP * scale)) }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {BAR_HEIGHTS.map((height, index) => (
        <MotiView
          key={`${height}-${index}`}
          from={{ height: height * scale * 0.35 }}
          animate={{ height: height * scale * amplitude }}
          transition={{
            type: 'timing',
            duration: 460 + index * 90,
            loop: true,
            repeatReverse: true,
            delay: index * 70,
          }}
          style={[styles.bar, { backgroundColor: color, width: barWidth, borderRadius: barWidth / 2 }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
  },
});
