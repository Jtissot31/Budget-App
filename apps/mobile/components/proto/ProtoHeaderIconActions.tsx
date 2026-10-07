/**
 * Proto circular header actions — edit (manage) + add.
 * Shared by Budget CATÉGORIES, Agenda, and Wallet section headers.
 */
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { PlusFabIcon } from '@/components/icons/PlusFabIcon';
import { useAppTheme } from '@/lib/themeContext';

const BTN_DEFAULT = 34;
const BTN_COMPACT = 30;
const ICON = 16;
/** Below this width, shrink buttons slightly so both stay on-screen. */
const COMPACT_WIDTH = 360;
/** Dark-theme add affordance — pure white (not off-white / muted grey). */
const ADD_BG_DARK = '#FFFFFF';
const ADD_ICON_DARK = '#0D0D0F';
/** At-capacity icon mute — keep circle solid white; never wash the whole control. */
const ADD_ICON_MUTED = 'rgba(13,13,15,0.38)';

type Props = {
  managing?: boolean;
  /**
   * When false, add stays visible and solid — icon only is muted.
   * Never use RN `disabled` (Samsung / Android can swallow presses).
   * Destination screens already guard the category max.
   */
  canAdd?: boolean;
  onEdit: () => void;
  /** Omit to hide the add button (e.g. a section with no create destination). */
  onAdd?: () => void;
  editAccessibilityLabel?: string;
  editDoneAccessibilityLabel?: string;
  addAccessibilityLabel?: string;
};

export function ProtoHeaderIconActions({
  managing = false,
  canAdd = true,
  onEdit,
  onAdd,
  editAccessibilityLabel = 'Gérer',
  editDoneAccessibilityLabel = 'Terminer la gestion',
  addAccessibilityLabel = 'Ajouter',
}: Props) {
  const { colors, isLight } = useAppTheme();
  const { width } = useWindowDimensions();
  const btnSize = width < COMPACT_WIDTH ? BTN_COMPACT : BTN_DEFAULT;
  const iconSize = btnSize <= BTN_COMPACT ? ICON - 1 : ICON;

  const editBg = managing ? ADD_BG_DARK : colors.surfaceElevated;
  const editIcon = managing ? ADD_ICON_DARK : colors.text;

  /** Dark: always solid white circle. Light: elevated surface. */
  const addBg = isLight ? colors.surfaceElevated : ADD_BG_DARK;
  const addIcon = isLight
    ? canAdd
      ? colors.text
      : colors.textMuted
    : canAdd
      ? ADD_ICON_DARK
      : ADD_ICON_MUTED;
  const addBorder = isLight ? colors.border : 'rgba(255,255,255,0.55)';

  const btnStyle = {
    width: btnSize,
    height: btnSize,
    borderRadius: btnSize / 2,
  };

  return (
    <View style={styles.row} collapsable={false} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={managing ? editDoneAccessibilityLabel : editAccessibilityLabel}
        accessibilityState={{ selected: managing }}
        hitSlop={12}
        onPress={onEdit}
        style={({ pressed }) => [
          styles.btn,
          btnStyle,
          { backgroundColor: editBg },
          Platform.OS === 'android' && styles.androidLift,
          pressed && styles.pressed,
        ]}
      >
        <AppIcon
          family="ionicons"
          name={managing ? 'checkmark' : 'create-outline'}
          size={iconSize}
          color={editIcon}
        />
      </Pressable>

      {onAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={addAccessibilityLabel}
          hitSlop={12}
          onPress={onAdd}
          style={({ pressed }) => [
            styles.btn,
            btnStyle,
            {
              backgroundColor: addBg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: addBorder,
            },
            Platform.OS === 'android' && styles.androidLift,
            pressed && styles.pressed,
          ]}
        >
          <PlusFabIcon size={iconSize + 2} color={addIcon} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** @deprecated Prefer {@link ProtoHeaderIconActions} */
export const BudgetCategoriesHeaderActions = ProtoHeaderIconActions;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    zIndex: 2,
    elevation: 4,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 0,
    flexShrink: 0,
  },
  /** Android: elevation required for reliable hit-testing above siblings. */
  androidLift: {
    elevation: 6,
  },
  pressed: { opacity: 0.78 },
});
