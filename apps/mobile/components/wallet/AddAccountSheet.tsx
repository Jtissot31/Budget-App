/**
 * « Ajouter un compte » — bank sync (Plaid) first, manual account types as a 2×2 grid below.
 */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DraggableSheetScrollView, DraggableSheetSurface } from '@/components/DraggableSheetSurface';
import { AppIcon } from '@/components/icons/AppIcon';
import { PressScale, Reveal } from '@/components/kit/motion';
import { jakartaBoldText, jakartaMediumText, jakartaSemiboldText, spacing, typography } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { FormSheetModalBody, formSheetScrollViewStyle, useFormSheetHeight } from '@/lib/sheet/formSheetScroll';
import { useAppTheme } from '@/lib/themeContext';
import type { AccountKind } from '@/types';

/** Manual account types — most common first. */
const MANUAL_KINDS: { id: AccountKind; label: string; caption: string; icon: string; accent: string }[] = [
  { id: 'checking', label: 'Chèque', caption: 'Compte courant', icon: 'wallet-outline', accent: '#3B82F6' },
  { id: 'savings', label: 'Épargne', caption: 'Compte d’épargne', icon: 'trending-up-outline', accent: '#14B8A6' },
  { id: 'credit', label: 'Crédit', caption: 'Carte ou marge', icon: 'card-outline', accent: '#A855F7' },
  { id: 'cash', label: 'Espèces', caption: 'Argent comptant', icon: 'cash-outline', accent: '#F59E0B' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectKind: (kind: AccountKind) => void;
  onConnectBank: () => void;
};

export function AddAccountSheet({ visible, onClose, onSelectKind, onConnectBank }: Props) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const sheetHeight = useFormSheetHeight(0.72);
  const surface = { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder };

  const pick = (action: () => void) => {
    tapHaptic();
    onClose();
    action();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.backdrop, { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
          <FormSheetModalBody>
            <DraggableSheetSurface
              onClose={onClose}
              sheetHeight={sheetHeight}
              style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.containerBorder }]}
            >
              <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
              <View style={styles.header}>
                <View style={styles.headerCopy}>
                  <Text style={[styles.title, { color: colors.text }]}>Ajouter un compte</Text>
                  <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                    Connecte ta banque ou crée un compte à la main.
                  </Text>
                </View>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel="Fermer"
                  onPress={onClose}
                  hitSlop={12}
                  scaleTo={0.88}
                  style={[styles.closeButton, { backgroundColor: colors.surfaceElevated }]}
                >
                  <AppIcon family="ionicons" name="close" size={18} color={colors.text} />
                </PressScale>
              </View>

              <DraggableSheetScrollView
                style={[styles.list, formSheetScrollViewStyle()]}
                contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.md) + 32 }]}
              >
                {/* Bank sync — the recommended path, so it leads. */}
                <Reveal index={0}>
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel="Connecter ma banque avec Plaid. Synchronisation automatique."
                    onPress={() => pick(onConnectBank)}
                    scaleTo={0.97}
                    style={[styles.syncCard, surface]}
                  >
                    <View style={styles.syncTop}>
                      <View style={[styles.syncIcon, { backgroundColor: `${colors.accentGreen}24` }]}>
                        <AppIcon family="ionicons" name="link" size={22} color={colors.accentGreen} />
                      </View>
                      <View style={[styles.badge, { backgroundColor: `${colors.accentGreen}24` }]}>
                        <Text style={[styles.badgeText, { color: colors.accentGreen }]}>Recommandé</Text>
                      </View>
                    </View>
                    <Text style={[styles.syncTitle, { color: colors.text }]}>Connecter ma banque</Text>
                    <Text style={[styles.syncBody, { color: colors.textMuted }]}>
                      Soldes et transactions synchronisés automatiquement — plus rien à saisir.
                    </Text>
                    <View style={[styles.syncFooter, { borderTopColor: colors.borderSubtle }]}>
                      <AppIcon family="ionicons" name="lock-closed" size={13} color={colors.textMuted} />
                      <Text style={[styles.syncFooterText, { color: colors.textMuted }]} numberOfLines={1}>
                        Chiffré via Plaid · accès en lecture seule
                      </Text>
                      <View style={[styles.syncCta, { backgroundColor: colors.text }]}>
                        <Text style={[styles.syncCtaText, { color: colors.background }]}>Connecter</Text>
                        <AppIcon family="ionicons" name="arrow-forward" size={14} color={colors.background} />
                      </View>
                    </View>
                  </PressScale>
                </Reveal>

                <Reveal index={1}>
                  <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Ou ajouter manuellement</Text>
                </Reveal>

                <View style={styles.grid}>
                  {MANUAL_KINDS.map((kind, index) => (
                    <Reveal key={kind.id} index={index + 2} style={styles.gridCell}>
                      <PressScale
                        accessibilityRole="button"
                        accessibilityLabel={`${kind.label}, ${kind.caption}`}
                        onPress={() => pick(() => onSelectKind(kind.id))}
                        scaleTo={0.95}
                        style={[styles.tile, surface]}
                      >
                        <View style={[styles.tileIcon, { backgroundColor: `${kind.accent}24` }]}>
                          <AppIcon family="ionicons" name={kind.icon} size={20} color={kind.accent} />
                        </View>
                        <Text style={[styles.tileLabel, { color: colors.text }]} numberOfLines={1}>
                          {kind.label}
                        </Text>
                        <Text style={[styles.tileCaption, { color: colors.textMuted }]} numberOfLines={1}>
                          {kind.caption}
                        </Text>
                      </PressScale>
                    </Reveal>
                  ))}
                </View>
              </DraggableSheetScrollView>
            </DraggableSheetSurface>
          </FormSheetModalBody>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: spacing.sm, marginBottom: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  headerCopy: { flex: 1, minWidth: 0, gap: 4 },
  title: { ...jakartaBoldText, fontSize: 22, letterSpacing: -0.3 },
  subtitle: { ...jakartaMediumText, fontSize: typography.meta, lineHeight: 18 },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: spacing.lg },

  syncCard: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 6 },
  syncTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  syncIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: 'center' },
  badgeText: { ...jakartaSemiboldText, fontSize: 11.5 },
  syncTitle: { ...jakartaBoldText, fontSize: 18, letterSpacing: -0.2 },
  syncBody: { ...jakartaMediumText, fontSize: typography.meta, lineHeight: 19 },
  syncFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  syncFooterText: { ...jakartaMediumText, fontSize: 11.5, flexShrink: 1 },
  syncCta: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  syncCtaText: { ...jakartaSemiboldText, fontSize: 13 },

  sectionLabel: { ...jakartaSemiboldText, fontSize: 12, letterSpacing: 0.2, marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  gridCell: { width: '50%', paddingHorizontal: 5, paddingBottom: 10 },
  tile: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 3 },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileLabel: { ...jakartaSemiboldText, fontSize: typography.body },
  tileCaption: { ...jakartaMediumText, fontSize: 12 },
});
