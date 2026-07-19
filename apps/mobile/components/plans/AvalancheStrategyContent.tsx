import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import type { LucideIcon } from 'lucide-react-native';
import { resolveLucideIcon } from '@/lib/lucideIconCatalog';
import ArrowRightMod from 'lucide-react-native/dist/cjs/icons/arrow-right.js';
import FlagMod from 'lucide-react-native/dist/cjs/icons/flag.js';
import FlameMod from 'lucide-react-native/dist/cjs/icons/flame.js';
import ListMod from 'lucide-react-native/dist/cjs/icons/list.js';
import TrendingDownMod from 'lucide-react-native/dist/cjs/icons/trending-down.js';
import WalletMod from 'lucide-react-native/dist/cjs/icons/wallet.js';
import {
  DebtStrategyTemplate,
  resolveStrategyWhyCopy,
} from '@/components/plans/DebtStrategyTemplate';
import { interBoldText } from '@/constants/theme';

const ArrowRight = resolveLucideIcon(ArrowRightMod)!;
const Flag = resolveLucideIcon(FlagMod)!;
const Flame = resolveLucideIcon(FlameMod)!;
const List = resolveLucideIcon(ListMod)!;
const TrendingDown = resolveLucideIcon(TrendingDownMod)!;
const Wallet = resolveLucideIcon(WalletMod)!;

type Props = {
  /** Raison personnalisée (suggestion IA) affichée dans « Pourquoi ça marche ». */
  whyOverride?: string;
};

/** Espace de dessin de l'illustration (mêmes proportions que la fiche boule de neige). */
const VIZ_W = 292;
const VIZ_H = 185;
const SLOPE_TOP = 40;
const SLOPE_H = 145;

/** Rampe monochrome de l'illustration avalanche — propre à ce visuel. */
const VIZ = {
  slopeEdge: '#45454B',
  slopeFill: '#1E1E22',
  arrow: '#66666C',
} as const;

const SLOPE_EDGE_POINTS = '0,24 25,37 95,69 165,104 243,136 292,145 0,145';
const SLOPE_FILL_POINTS = '0,27 28,40 98,72 168,107 246,139 292,145 0,145';

type VizBall = {
  x: number;
  y: number;
  size: number;
  bg: string;
  border?: string;
  label: string;
  labelColor: string;
  fontSize: number;
};

/** Les taux les plus élevés sont attaqués en premier — la dette la plus chère en tête. */
const BALLS: readonly VizBall[] = [
  { x: 20, y: 39, size: 48, bg: '#FFFFFF', label: '22 %', labelColor: '#050505', fontSize: 12 },
  { x: 96, y: 83, size: 38, bg: '#8A8A90', label: '18 %', labelColor: '#111111', fontSize: 10 },
  { x: 168, y: 125, size: 28, bg: '#5A5A60', label: '11 %', labelColor: '#FFFFFF', fontSize: 9 },
  { x: 236, y: 159, size: 20, bg: '#2C2C31', border: '#3A3A40', label: '5 %', labelColor: '#C9C9CE', fontSize: 7 },
];

type VizMilestone = {
  x: number;
  y: number;
  icons: readonly LucideIcon[];
  label: string;
  color: string;
};

const MILESTONES: readonly VizMilestone[] = [
  { x: -6, y: 4, icons: [List], label: 'Classer par taux', color: '#88888E' },
  { x: 64, y: 28, icons: [Wallet], label: 'Payer les minimums', color: '#AAAAB0' },
  { x: 135, y: 51, icons: [Flame], label: 'Surplus au plus haut taux', color: '#DDDDE2' },
  { x: 208, y: 71, icons: [TrendingDown, Flag], label: 'Moins d’intérêts payés', color: '#FFFFFF' },
];

const MILESTONE_ARROWS: readonly { x: number; y: number }[] = [
  { x: 60, y: 35 },
  { x: 130, y: 58 },
  { x: 202, y: 80 },
];

const STEPS: readonly string[] = [
  'Classe toutes tes dettes du taux d’intérêt le plus élevé au plus bas (peu importe le solde).',
  'Paie le montant minimum sur toutes tes dettes, sauf celle au taux le plus élevé.',
  'Mets tout l’argent qu’il te reste sur cette dette la plus coûteuse, jusqu’à ce qu’elle soit remboursée.',
  'Passe à la dette au taux le plus élevé suivant, et répète — jusqu’à ce que tout soit payé.',
];

/** Copy éducatif « Pourquoi ça marche » — pas le teaser catalogue. */
const WHY_IT_WORKS =
  'En éliminant d’abord les dettes aux taux les plus élevés, tu réduis les intérêts qui s’accumulent chaque mois — c’est la méthode la moins chère sur la durée, même si les premières victoires peuvent prendre plus de temps qu’avec la boule de neige.';

/** Blurb courte catalogue / cartes — ne doit pas remplacer le texte de la fiche. */
const CATALOG_WHY_TEASER =
  'On attaque d’abord la dette au plus haut taux d’intérêt.';

/** Illustration « les taux les plus élevés sont emportés en premier ». */
function AvalancheViz() {
  const [width, setWidth] = useState(0);
  const s = width > 0 ? width / VIZ_W : 0;

  return (
    <View
      style={{ height: width > 0 ? VIZ_H * s : VIZ_H }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {s > 0 ? (
        <>
          <Svg
            width={width}
            height={SLOPE_H * s}
            viewBox={`0 0 ${VIZ_W} ${SLOPE_H}`}
            style={{ position: 'absolute', left: 0, top: SLOPE_TOP * s }}
          >
            <Polygon points={SLOPE_EDGE_POINTS} fill={VIZ.slopeEdge} />
            <Polygon points={SLOPE_FILL_POINTS} fill={VIZ.slopeFill} />
          </Svg>

          {MILESTONES.map((m) => (
            <View
              key={m.label}
              style={[styles.milestone, { left: m.x * s, top: m.y * s, width: 68 * s }]}
            >
              <View style={styles.milestoneIcons}>
                {m.icons.map((Icon, i) => (
                  <Icon key={i} size={16 * s} color={m.color} strokeWidth={2} />
                ))}
              </View>
              <Text style={[styles.milestoneLabel, { color: m.color, fontSize: Math.round(9 * s) }]}>
                {m.label}
              </Text>
            </View>
          ))}

          {MILESTONE_ARROWS.map((a, i) => (
            <View
              key={i}
              style={{ position: 'absolute', left: a.x * s, top: a.y * s, transform: [{ rotate: '24deg' }] }}
            >
              <ArrowRight size={12 * s} color={VIZ.arrow} strokeWidth={2.4} />
            </View>
          ))}

          {BALLS.map((ball) => (
            <View
              key={ball.label}
              style={[
                styles.ball,
                {
                  left: ball.x * s,
                  top: ball.y * s,
                  width: ball.size * s,
                  height: ball.size * s,
                  borderRadius: (ball.size * s) / 2,
                  backgroundColor: ball.bg,
                  borderWidth: ball.border ? 1 : 0,
                  borderColor: ball.border,
                },
              ]}
            >
              <Text style={[styles.ballLabel, { color: ball.labelColor, fontSize: Math.round(ball.fontSize * s) }]}>
                {ball.label}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

/**
 * Contenu de la fiche stratégie « Avalanche » — illustration, pitch,
 * étapes numérotées et carte « Pourquoi ça marche ».
 */
export function AvalancheStrategyContent({ whyOverride }: Props) {
  return (
    <DebtStrategyTemplate
      hero={<AvalancheViz />}
      heroCaptionFrom="Du taux le plus élevé"
      heroCaptionTo="au plus bas"
      heading="Les intérêts les plus chers d’abord"
      lead="Tu attaques d’abord la dette au taux d’intérêt le plus élevé, peu importe le solde. Chaque dollar de surplus réduit ce qui te coûte le plus cher."
      steps={STEPS}
      whyCopy={resolveStrategyWhyCopy(whyOverride, WHY_IT_WORKS, CATALOG_WHY_TEASER)}
    />
  );
}

const styles = StyleSheet.create({
  milestone: {
    position: 'absolute',
    alignItems: 'center',
  },
  milestoneIcons: {
    flexDirection: 'row',
    gap: 2,
  },
  milestoneLabel: {
    ...interBoldText,
    lineHeight: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  ball: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballLabel: {
    ...interBoldText,
    letterSpacing: -0.2,
  },
});
