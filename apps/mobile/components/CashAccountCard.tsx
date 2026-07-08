import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { jakartaMediumText, jakartaSemiboldText, moneyAmountTypography } from '@/constants/theme';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import type { SimulatedAccount } from '@/types';

/**
 * Closed bifold leather wallet — landscape (~1.5:1), sharp corners, visible top flap,
 * card-slot pocket, bifold crease, offset back plane. Not a bank card silhouette.
 */
const WALLET_ASPECT_RATIO = 1.5;

const VB_W = 150;
const VB_H = 100;

/** Top flap covers ~22% of height */
const FLAP_H = 22;

/** Bifold horizontal crease at ~45% */
const CREASE_Y = 45;

const CORNER_R = 2;
const VIEW_RADIUS = 3;
const STITCH_IN = 4;

const C = {
  back: '#0A0A0C',
  void: '#0E0E10',
  slot: '#121214',
  leather: '#1A1A1A',
  leatherMid: '#1C1C1F',
  edge: 'rgba(255,255,255,0.04)',
  foldLine: 'rgba(255,255,255,0.05)',
  foldShadow: 'rgba(0,0,0,0.45)',
  flapShadow: 'rgba(0,0,0,0.55)',
  highlight: 'rgba(255,255,255,0.03)',
  stitch: 'rgba(255,255,255,0.08)',
  label: 'rgba(255,255,255,0.45)',
  text: '#ffffff',
  name: 'rgba(255,255,255,0.70)',
  negative: '#FF6B6B',
} as const;

/** Trapezoid top edge — wallet flap read, not a flat card rectangle */
const FLAP_PATH =
  `M ${CORNER_R} 5 ` +
  `L ${VB_W - CORNER_R} 2 ` +
  `L ${VB_W - CORNER_R} ${FLAP_H} ` +
  `L ${CORNER_R} ${FLAP_H + 1} ` +
  `Q 0 ${FLAP_H + 1} 0 ${FLAP_H - 1} ` +
  `L 0 ${CORNER_R + 3} ` +
  `Q 0 5 ${CORNER_R} 5 Z`;

function WalletSurface() {
  return (
    <Svg
      style={StyleSheet.absoluteFillObject}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={C.leatherMid} />
          <Stop offset="0.15" stopColor={C.leather} />
          <Stop offset="1" stopColor={C.void} />
        </LinearGradient>
        <LinearGradient id="flapInnerShadow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="rgba(0,0,0,0)" />
          <Stop offset="1" stopColor={C.flapShadow} />
        </LinearGradient>
      </Defs>

      {/* Front leather face */}
      <Rect
        x={0}
        y={0}
        width={VB_W}
        height={VB_H}
        rx={CORNER_R}
        fill="url(#bodyGrad)"
      />

      {/* Subtle top highlight — dark tone, not glossy white sheen */}
      <Line
        x1={CORNER_R}
        y1={0.8}
        x2={VB_W - CORNER_R}
        y2={0.8}
        stroke={C.highlight}
        strokeWidth={0.75}
      />

      {/* Bifold crease at ~45% — fold line + shadow below */}
      <Line
        x1={0}
        y1={CREASE_Y}
        x2={VB_W}
        y2={CREASE_Y}
        stroke={C.foldLine}
        strokeWidth={1}
      />
      <Line
        x1={0}
        y1={CREASE_Y + 1}
        x2={VB_W}
        y2={CREASE_Y + 1}
        stroke={C.foldShadow}
        strokeWidth={0.8}
      />

      {/* Dark cards in slot — drawn before flap so only tops peek out */}
      <Rect
        x={26}
        y={4}
        width={24}
        height={12}
        rx={1}
        fill={C.slot}
        stroke={C.edge}
        strokeWidth={0.4}
      />
      <Rect
        x={58}
        y={3}
        width={24}
        height={13}
        rx={1}
        fill={C.void}
        stroke={C.edge}
        strokeWidth={0.4}
      />
      <Rect
        x={90}
        y={5}
        width={24}
        height={11}
        rx={1}
        fill={C.leatherMid}
        stroke={C.edge}
        strokeWidth={0.4}
      />

      {/* Slot pocket lip hides lower card edges */}
      <Rect x={0} y={13} width={VB_W} height={FLAP_H - 8} fill={C.slot} />

      {/* Overlapping wallet flap — darker layer on top ~22% */}
      <Path d={FLAP_PATH} fill={C.void} />

      {/* Inner shadow where flap meets body */}
      <Rect
        x={0}
        y={FLAP_H - 1}
        width={VB_W}
        height={4}
        fill="url(#flapInnerShadow)"
      />
      <Line
        x1={0}
        y1={FLAP_H + 0.5}
        x2={VB_W}
        y2={FLAP_H + 0.5}
        stroke={C.flapShadow}
        strokeWidth={0.6}
      />

      {/* Perimeter stitching — inset dashed border */}
      <Rect
        x={STITCH_IN}
        y={STITCH_IN}
        width={VB_W - 2 * STITCH_IN}
        height={VB_H - 2 * STITCH_IN}
        rx={1}
        fill="none"
        stroke={C.stitch}
        strokeWidth={0.6}
        strokeDasharray="2 2.5"
        strokeLinecap="butt"
      />
    </Svg>
  );
}

type CashAccountCardProps = {
  account: SimulatedAccount;
};

export function CashAccountCard({ account }: CashAccountCardProps) {
  const displayName = account.name.trim() || 'Argent Cash';
  const balanceColor = account.balance < 0 ? C.negative : C.text;

  return (
    <View style={styles.shadowWrap}>
      {/* Stacked wallet depth — offset back layer */}
      <View style={styles.backPlane} />

      <View style={styles.walletShell}>
        <WalletSurface />

        <View style={styles.content} pointerEvents="box-none">
          <View style={styles.upperZone} />

          <View style={styles.mainFace}>
            <View style={styles.balanceBlock}>
              <Text style={styles.balanceLabel}>Solde disponible</Text>
              <Text
                style={[styles.balanceAmount, { color: balanceColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {formatCompactCurrency(account.balance)}
              </Text>
            </View>

            <View style={styles.footer}>
              <Text style={styles.accountName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.kindLabel}>Liquide</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    width: '100%',
    aspectRatio: WALLET_ASPECT_RATIO,
    minHeight: 96,
    position: 'relative',
  },
  backPlane: {
    position: 'absolute',
    top: 4,
    left: 3,
    right: -3,
    bottom: -4,
    borderRadius: VIEW_RADIUS,
    backgroundColor: C.back,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 3,
  },
  walletShell: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: VIEW_RADIUS,
    overflow: 'hidden',
    backgroundColor: C.leather,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  upperZone: {
    flex: 40,
  },
  mainFace: {
    flex: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  balanceBlock: {
    gap: 3,
    alignItems: 'flex-start',
    paddingTop: 4,
  },
  balanceLabel: {
    ...jakartaMediumText,
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: C.label,
  },
  balanceAmount: {
    ...moneyAmountTypography({
      tier: 'stat',
      fontSize: 26,
      lineHeight: 30,
      letterSpacing: -0.5,
      textAlign: 'left',
    }),
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  accountName: {
    ...jakartaSemiboldText,
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: C.name,
  },
  kindLabel: {
    ...jakartaMediumText,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: C.label,
    flexShrink: 0,
  },
});
