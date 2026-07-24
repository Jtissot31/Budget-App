import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { MOTION, pageEnterTransition } from '@/constants/motionKit';
import { PAGE_PADDING_HORIZONTAL } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type PageTransitionProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * When false, skip enter motion (static flex shell only).
   * @default true
   */
  animate?: boolean;
};

/**
 * Page shell with a subtle fade/slide enter on mount.
 * Stack/tab navigators still own route transitions; this settles content once.
 * Respects Reduce Motion. Web: horizontal margin on an inner shell.
 */
export function PageTransition({ children, style, animate = true }: PageTransitionProps) {
  const { colors } = useAppTheme();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const shell = (
    <View style={[{ flex: 1, backgroundColor: colors.background }, style]} collapsable={false}>
      {Platform.OS === 'web' ? (
        <View style={{ flex: 1, marginHorizontal: PAGE_PADDING_HORIZONTAL, minWidth: 0 }}>
          {children}
        </View>
      ) : (
        children
      )}
    </View>
  );

  if (!animate || reduceMotion) {
    return shell;
  }

  return (
    <MotiView
      from={{ opacity: 0, translateY: MOTION.pageEnterTranslateY }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={pageEnterTransition}
      style={{ flex: 1 }}
    >
      {shell}
    </MotiView>
  );
}
