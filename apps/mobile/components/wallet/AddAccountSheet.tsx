/**
 * « Ajouter un compte » — bank sync (Plaid) first, then manual account types as a grouped list.
 * Monochrome, filled surfaces, no outlines.
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
const MANUAL_KINDS: { id: AccountKind; label: string; caption: string; icon: string }[] = [
  { id: 'checking', label: 'Chèque', caption: 'Compte courant', icon: 'wallet-outline' },
  { id: 'savings', label: 'Épargne', caption: 'Compte d’épargne', icon: 'trending-up-outline' },
  { id: 'credit', label: 'Crédit', caption: 'Carte ou marge', icon: 'card-outline' },
  { id: 'cash', label: 'Espèces', caption: 'Argent comptant', icon: 'cash-outline' },
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
  const fill = colors.containerBackground;
  const well = colors.surfaceElevated;

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
              style={[styles.sheet, { backgroundColor: colors.background }]}
            >
              <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Ajouter un compte</Text>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel="Fermer"
                  onPress={onClose}
                  hitSlop={12}
                  scaleTo={0.88}
                  style={[styles.closeButton, { backgroundColor: well }]}
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
                    style={[styles.syncCard, { backgroundColor: fill }]}
                  >
                    <View style={[styles.icon, { backgroundColor: well }]}>
                      <AppIcon family="ionicons" name="link-outline" size={20} color={colors.text} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={[styles.syncTitle, { color: colors.text }]}>Connecter ma banque</Text>
                      <Text style={[styles.caption, { color: colors.textMuted }]} numberOfLines={1}>
                        Synchro auto · lecture seule via Plaid
                      </Text>
                    </View>
                    <View style={[styles.syncCta, { backgroundColor: colors.text }]}>
                      <AppIcon family="ionicons" name="arrow-forward" size={16} color={colors.background} />
                    </View>
                  </PressScale>
                </Reveal>

                <Reveal index={1}>
                  <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Ou à la main</Text>
                </Reveal>

                <Reveal index={2}>
                  <View style={[styles.group, { backgroundColor: fill }]}>
                    {MANUAL_KINDS.map((kind, index) => (
                      <PressScale
                        key={kind.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${kind.label}, ${kind.caption}`}
                        onPress={() => pick(() => onSelectKind(kind.id))}
                        scaleTo={0.98}
                      >
                        <View style={styles.row}>
                          <View style={[styles.icon, { backgroundColor: well }]}>
                            <AppIcon family="ionicons" name={kind.icon} size={19} color={colors.text} />
                          </View>
                          <View
                            style={[
                              styles.rowBody,
                              index < MANUAL_KINDS.length - 1 && {
                                borderBottomWidth: StyleSheet.hairlineWidth,
                                borderBottomColor: colors.borderSubtle,
                              },
                            ]}
                          >
                            <View style={styles.rowCopy}>
                              <Text style={[styles.rowLabel, { color: colors.text }]}>{kind.label}</Text>
                              <Text style={[styles.caption, { color: colors.textMuted }]} numberOfLines={1}>
                                {kind.caption}
                              </Text>
                            </View>
                            <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
                          </View>
                        </View>
                      </PressScale>
                    ))}
                  </View>
                </Reveal>
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
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: spacing.sm, marginBottom: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  title: { ...jakartaBoldText, fontSize: 22, letterSpacing: -0.3, flexShrink: 1 },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: spacing.lg },

  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  caption: { ...jakartaMediumText, fontSize: 12.5 },

  syncCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 14 },
  syncTitle: { ...jakartaSemiboldText, fontSize: typography.body },
  syncCta: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  sectionLabel: { ...jakartaSemiboldText, fontSize: 12, letterSpacing: 0.2, marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: 2 },
  group: { borderRadius: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingRight: 14 },
  rowLabel: { ...jakartaSemiboldText, fontSize: typography.body },
});
