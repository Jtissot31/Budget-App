import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  DraggableSheetScrollView,
  DraggableSheetSurface,
} from '@/components/DraggableSheetSurface';
import { FormSheetModalBody } from '@/lib/sheet/formSheetScroll';
import { OnyxContainer } from '@/components/OnyxContainer';
import {
  ONYX_CONTAINER,
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import {
  jakartaBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { formSheetScrollViewStyle } from '@/lib/sheet/formSheetScroll';
import {
  ALERT_TYPE_PREFERENCE_IDS,
  ALERT_TYPE_PREFERENCE_LABELS,
  defaultAlertTypePreferences,
  getAlertTypePreferences,
  setAlertTypePreference,
  type AlertTypePreferenceId,
  type AlertTypePreferences,
} from '@/lib/alertTypePreferences';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Optional: keep mark-all-read reachable from the settings sheet. */
  unreadCount?: number;
  onMarkAllRead?: () => void;
};

export function AlertTypePreferencesSheet({
  visible,
  onClose,
  unreadCount = 0,
  onMarkAllRead,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(windowHeight * 0.72);
  const [prefs, setPrefs] = useState<AlertTypePreferences>(defaultAlertTypePreferences);

  const backdropColor = useMemo(
    () => (isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)'),
    [isLight],
  );

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void getAlertTypePreferences().then((next) => {
      if (!cancelled) setPrefs(next);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const toggle = (id: AlertTypePreferenceId) => {
    tapHaptic();
    const enabled = !prefs[id];
    setPrefs((current) => ({ ...current, [id]: enabled }));
    void setAlertTypePreference(id, enabled);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.backdrop, { backgroundColor: backdropColor }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
          <FormSheetModalBody>
          <DraggableSheetSurface
            onClose={onClose}
            sheetHeight={sheetHeight}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background,
                borderColor: colors.containerBorder,
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>Types d’alertes</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                onPress={onClose}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <AppIcon family="ionicons" name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Décochez un type pour ne plus le recevoir sur Accueil ni dans Messages.
            </Text>

            <DraggableSheetScrollView
              style={[styles.list, formSheetScrollViewStyle()]}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: Math.max(insets.bottom, spacing.md) + 48 },
              ]}
            >
              {ALERT_TYPE_PREFERENCE_IDS.map((id) => {
                const checked = prefs[id] !== false;
                const label = ALERT_TYPE_PREFERENCE_LABELS[id];
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={label}
                    onPress={() => toggle(id)}
                    style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
                  >
                    <OnyxContainer halo={false} style={styles.optionRow}>
                      <View style={styles.optionCopy}>
                        <Text style={[styles.optionLabel, { color: colors.text }]} numberOfLines={2}>
                          {label}
                        </Text>
                      </View>
                      {checked ? (
                        <AppIcon
                          family="ionicons"
                          name="checkbox"
                          size={24}
                          color={colors.primary}
                        />
                      ) : (
                        <AppIcon
                          family="ionicons"
                          name="square-outline"
                          size={24}
                          color={colors.borderStrong}
                        />
                      )}
                    </OnyxContainer>
                  </Pressable>
                );
              })}

              {unreadCount > 0 && onMarkAllRead ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tout marquer comme lu"
                  onPress={() => {
                    tapHaptic();
                    onMarkAllRead();
                  }}
                  style={({ pressed }) => [
                    styles.markAllButton,
                    {
                      borderColor: colors.containerBorder,
                      backgroundColor: colors.surfaceElevated,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <AppIcon
                    family="ionicons"
                    name="checkmark-done-outline"
                    size={18}
                    color={colors.text}
                  />
                  <Text style={[styles.markAllLabel, { color: colors.text }]}>
                    Tout marquer comme lu
                  </Text>
                </Pressable>
              ) : null}
            </DraggableSheetScrollView>
          </DraggableSheetSurface>
          </FormSheetModalBody>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.card + 4,
    borderTopRightRadius: radius.card + 4,
    borderWidth: 1,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.md,
  },
  title: {
    ...jakartaBoldText,
    fontSize: typography.body,
    flex: 1,
  },
  subtitle: {
    ...jakartaMediumText,
    fontSize: typography.caption,
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: ONYX_CONTAINER.listGap,
  },
  optionRow: {
    ...onyxContainerRowLayoutStyle(),
    minHeight: 56,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    ...jakartaSemiboldText,
    fontSize: typography.body,
  },
  markAllButton: {
    marginTop: spacing.sm,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  markAllLabel: {
    ...jakartaSemiboldText,
    fontSize: typography.caption,
  },
  pressed: { opacity: 0.72 },
});
