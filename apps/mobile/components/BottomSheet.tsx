import { ReactNode, useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  StyleProp,
  Text,
  View,
  ViewStyle,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { DetailSurfaceGradient } from '@/components/DetailSurfaceGradient';
import { radius, spacing, typography, type AppColors } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Inline control shown at the trailing edge of the title row (ex. pencil). */
  titleAccessory?: ReactNode;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  /** Merged after default scroll `content` padding (e.g. tighter gutters, safe-area-aware). */
  scrollContentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * When false, children render in a flex column inside the sheet instead of `ScrollView`
   * (use for nested `FlatList` / virtualization).
   */
  scrollable?: boolean;
};

export function BottomSheet({
  visible,
  onClose,
  title,
  titleAccessory,
  children,
  sheetStyle,
  scrollContentContainerStyle,
  scrollable = true,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);

  /** Fixed viewport share so flex + `FlatList` layouts measure reliably outside `ScrollView`. */
  const sheetFixedHeight = Math.min(windowHeight * 0.88, windowHeight);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, !scrollable && { height: sheetFixedHeight }, sheetStyle]}>
          <DetailSurfaceGradient isLight={isLight} />
          <View style={styles.handle} />
          {title ? (
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
              {titleAccessory}
            </View>
          ) : null}
          {scrollable ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[styles.content, scrollContentContainerStyle]}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.nonScrollBody, scrollContentContainerStyle]}>
              {children}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingBottom: spacing.xl,
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: typography.dashboardGreeting,
    fontWeight: '700',
  },

  scroll: { maxHeight: '100%' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  nonScrollBody: { flex: 1, minHeight: 0 },
  });
}
