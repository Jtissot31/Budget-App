import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamilies } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { resolveLucideIcon } from '@/lib/lucideIconCatalog';
import ChartPieMod from 'lucide-react-native/dist/cjs/icons/chart-pie.js';
import CircleCheckMod from 'lucide-react-native/dist/cjs/icons/circle-check.js';

const ChartPie = resolveLucideIcon(ChartPieMod)!;
const CircleCheck = resolveLucideIcon(CircleCheckMod)!;

type Props = {
  onPressInsights: () => void;
  onPressReview: () => void;
  pendingCount?: number;
  /** When true, skip horizontal padding (parent already applies page inset). */
  embedded?: boolean;
};

export function TransactionsShortcutCards({
  onPressInsights,
  onPressReview,
  pendingCount = 0,
  embedded = false,
}: Props) {
  return (
    <View style={[styles.row, embedded && styles.rowEmbedded]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ouvrir l'analyse des dépenses par catégorie"
        onPress={() => {
          tapHaptic();
          onPressInsights();
        }}
        style={({ pressed }) => [styles.badge, styles.badgeAnalyse, pressed && styles.pressed]}
      >
        <ChartPie size={11} color="#4ADE80" strokeWidth={2.25} />
        <Text style={styles.badgeAnalyseText}>Analyse</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          pendingCount > 0
            ? `Compléter ${pendingCount} dépense${pendingCount > 1 ? 's' : ''} scannée${pendingCount > 1 ? 's' : ''} sans articles`
            : 'Revoir les dépenses scannées sans articles'
        }
        onPress={() => {
          tapHaptic();
          onPressReview();
        }}
        style={({ pressed }) => [styles.badge, styles.badgeReview, pressed && styles.pressed]}
      >
        <CircleCheck size={11} color="#666" strokeWidth={2.25} />
        <Text style={styles.badgeReviewText}>À compléter</Text>
        {pendingCount > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{pendingCount > 99 ? '99+' : pendingCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 0,
  },
  rowEmbedded: {
    marginTop: 0,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  badgeAnalyse: {
    backgroundColor: '#18181A',
    borderColor: '#4ADE8030',
  },
  badgeAnalyseText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    lineHeight: 14,
    color: '#4ADE80',
    includeFontPadding: false,
  },
  badgeReview: {
    backgroundColor: '#18181A',
    borderColor: '#2A2A2C',
  },
  badgeReviewText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    lineHeight: 14,
    color: '#666',
    includeFontPadding: false,
  },
  countBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: '#C9974A20',
    marginLeft: 2,
  },
  countBadgeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 9,
    lineHeight: 11,
    color: '#C9974A',
    includeFontPadding: false,
  },
  pressed: {
    opacity: 0.82,
  },
});
