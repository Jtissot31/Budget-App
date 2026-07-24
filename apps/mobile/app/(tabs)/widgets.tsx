import { useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AIWidgetRenderer } from '@/components/chat/AIWidgetRenderer';
import { useAIChatColors } from '@/components/ai-chat/theme';
import { PageTransition } from '@/components/PageTransition';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  FLOATING_NAV_CONTENT_PADDING,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_CONTENT_GAP,
  PAGE_TITLE_STYLE,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { FYN_WIDGET_GALLERY } from '@/lib/dev/fynWidgetGallery';
import { useAppTheme } from '@/lib/themeContext';

export default function WidgetGalleryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const chatPalette = useAIChatColors();
  const scrollRef = useRef<ScrollView>(null);

  useScrollToTopOnFocus(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  return (
    <PageTransition style={[styles.page, { backgroundColor: chatPalette.background }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + SCREEN_TOP_GUTTER,
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[PAGE_TITLE_STYLE, { color: colors.text }]}>Galerie widgets</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Aperçu de tous les widgets Fyn tels qu&apos;ils apparaissent dans le chat.
          </Text>
        </View>

        <View style={[styles.chatStage, { backgroundColor: chatPalette.background }]}>
          {FYN_WIDGET_GALLERY.map((entry) => (
            <View key={entry.id} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.primary }]}>{entry.typeLabel}</Text>
                <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>
                  {entry.data.type}
                  {entry.subtitle ? ` · ${entry.subtitle}` : ''}
                </Text>
              </View>

              <View style={styles.widgetBlock}>
                <AIWidgetRenderer data={entry.data} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    gap: PAGE_TITLE_CONTENT_GAP,
  },
  header: {
    gap: spacing.sm,
  },
  subtitle: {
    ...typographyKit.body,
    lineHeight: 22,
  },
  chatStage: {
    width: '100%',
    alignSelf: 'stretch',
    gap: spacing.xl,
  },
  section: {
    width: '100%',
    gap: spacing.sm,
  },
  sectionHeader: {
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typographyKit.eyebrow,
  },
  sectionMeta: {
    ...typographyKit.meta,
  },
  widgetBlock: {
    width: '100%',
    marginTop: spacing.xs,
  },
});
