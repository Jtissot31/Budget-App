/**
 * Shared form-sheet chrome (handle + title / close row).
 *
 * FORM-SHEET HEADER RULE — do not regress
 * ----------------------------------------
 * Title + X sit tight under the drag pill. Do not reinflate `handleHitArea` to
 * `SHEET_HANDLE_DRAG_ZONE_HEIGHT` (56) for *layout* — that constant is only the
 * gesture hit zone. Visual chrome uses `FORM_SHEET_HANDLE_HIT_HEIGHT`.
 *
 * FIXED (not sticky): always render `FormSheetChromeHeader` *outside* the sheet
 * ScrollView / `DraggableSheetScrollView`, as a sibling above the scroller.
 * Never put chrome inside scroll content (scrolls away) or use sticky indices.
 *
 * Prefer `FormSheetChromeHeader` or the style helpers below in every
 * `FormSheetModalBody` form (add-transaction, add-budget-category, recurring,
 * savings goals, …). Keyboard avoidance stays in `formSheetScroll.ts` /
 * `FORM_SHEET_KEYBOARD.md` — never shrink chrome via padding hacks here.
 */

import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { jakartaExtraBoldText, radius, spacing, typography } from '@/constants/theme';

/** Visual strip for the drag pill (layout). Gesture zone stays 56px separately. */
export const FORM_SHEET_HANDLE_HIT_HEIGHT = 32;

/** Top padding inside scroll / panel content above the handle. */
export const FORM_SHEET_CONTENT_PADDING_TOP = spacing.xs;

/** Handle + title row approx after tightening (was ~96 with a 56px hit area). */
export const FORM_SHEET_CHROME_HEIGHT = 72;

export const formSheetContentPaddingTopStyle: ViewStyle = {
  paddingTop: FORM_SHEET_CONTENT_PADDING_TOP,
};

export const formSheetChromeRootStyle: ViewStyle = {
  flexShrink: 0,
};

export const formSheetHandleHitStyle: ViewStyle = {
  alignSelf: 'stretch',
  alignItems: 'center',
  justifyContent: 'center',
  height: FORM_SHEET_HANDLE_HIT_HEIGHT,
  flexShrink: 0,
};

export const formSheetHandlePillStyle: ViewStyle = {
  alignSelf: 'center',
  width: 44,
  height: 4,
  borderRadius: radius.pill,
};

export const formSheetHeaderRowStyle: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexShrink: 0,
};

export const formSheetTitleStyle: TextStyle = {
  flex: 1,
  ...jakartaExtraBoldText,
  fontSize: typography.title,
  letterSpacing: -0.4,
};

export const formSheetCloseButtonStyle: ViewStyle = {
  width: 34,
  height: 34,
  borderRadius: 17,
  alignItems: 'center',
  justifyContent: 'center',
};

type FormSheetChromeHeaderProps = {
  title: string;
  onClose: () => void;
  titleColor: string;
  closeIconColor: string;
  handleColor: string;
  closeButtonStyle?: StyleProp<ViewStyle>;
  headerStyle?: StyleProp<ViewStyle>;
  /** Extra nodes after the title (rare). */
  titleAccessory?: ReactNode;
};

/**
 * Drag pill + title / close row for form sheets.
 * Keeps Nouveau revenu / add-expense / recurring / goals headers consistent.
 */
export function FormSheetChromeHeader({
  title,
  onClose,
  titleColor,
  closeIconColor,
  handleColor,
  closeButtonStyle,
  headerStyle,
  titleAccessory,
}: FormSheetChromeHeaderProps) {
  return (
    <View style={formSheetChromeRootStyle}>
      <View style={formSheetHandleHitStyle}>
        <View style={[formSheetHandlePillStyle, { backgroundColor: handleColor }]} />
      </View>
      <View style={[formSheetHeaderRowStyle, headerStyle]}>
        <Text
          style={[formSheetTitleStyle, { color: titleColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
        >
          {title}
        </Text>
        {titleAccessory}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          onPress={onClose}
          hitSlop={12}
          style={[formSheetCloseButtonStyle, closeButtonStyle]}
        >
          <AppIcon family="ionicons" name="close" size={19} color={closeIconColor} />
        </Pressable>
      </View>
    </View>
  );
}

export const formSheetChromeStyles = StyleSheet.create({
  contentPaddingTop: formSheetContentPaddingTopStyle,
  handleHit: formSheetHandleHitStyle,
  handlePill: formSheetHandlePillStyle,
  headerRow: formSheetHeaderRowStyle,
  title: formSheetTitleStyle,
  closeButton: formSheetCloseButtonStyle,
});
