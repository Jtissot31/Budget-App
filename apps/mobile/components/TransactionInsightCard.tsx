import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import { useState } from 'react';

import { Ionicons } from '@expo/vector-icons';

import { GlassContainer } from '@/components/GlassContainer';

import { SurfaceCard } from '@/components/SurfaceCard';

import {

  detailSectionLabelStyle,

  detailSectionsCardStyle,

  jakartaBoldText,
  jakartaExtraBoldText,
  jakartaMediumText,

  radius,

  spacing,

  typography,

  typographyKit,

} from '@/constants/theme';

import { useAppTheme } from '@/lib/themeContext';

import type { TransactionInsight } from '@/lib/transactionInsight';



if (Platform.OS === 'android') {

  UIManager.setLayoutAnimationEnabledExperimental?.(true);

}



type RichSegment = { text: string; bold?: boolean };



function parseRichText(text: string): RichSegment[] {

  const segments: RichSegment[] = [];

  const regex = /\*\*(.+?)\*\*/g;

  let lastIndex = 0;

  let match: RegExpExecArray | null;



  while ((match = regex.exec(text)) !== null) {

    if (match.index > lastIndex) {

      segments.push({ text: text.slice(lastIndex, match.index) });

    }

    segments.push({ text: match[1], bold: true });

    lastIndex = regex.lastIndex;

  }



  if (lastIndex < text.length) {

    segments.push({ text: text.slice(lastIndex) });

  }



  return segments.length ? segments : [{ text }];

}



function stripMarkdown(text: string): string {

  return text.replace(/\*\*(.+?)\*\*/g, '$1');

}



function InsightTipText({ text, color }: { text: string; color: string }) {

  const segments = parseRichText(text);



  return (

    <Text style={[styles.tipText, { color }]}>

      {segments.map((segment, index) => (

        <Text key={`seg-${index}`} style={segment.bold ? jakartaBoldText : undefined}>

          {segment.text}

        </Text>

      ))}

    </Text>

  );

}



type Props = {

  insight: TransactionInsight;

};



export function TransactionInsightCard({ insight }: Props) {

  const { colors } = useAppTheme();

  const accentColor = colors.success;

  const [expanded, setExpanded] = useState(false);

  const teaser = stripMarkdown(insight.tip);



  function toggle() {

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setExpanded((prev) => !prev);

  }



  if (expanded) {

    return (

      <SurfaceCard style={detailSectionsCardStyle()}>

        <Pressable

          onPress={toggle}

          style={styles.expandedHeaderRow}

          accessibilityRole="button"

          accessibilityLabel="Conseil IA"

          accessibilityState={{ expanded: true }}

        >

          <View style={[styles.iconWell, { backgroundColor: colors.successMuted, borderColor: `${accentColor}33` }]}>

            <Ionicons name="sparkles-outline" size={14} color={accentColor} />

          </View>

          <Text style={[detailSectionLabelStyle(), styles.expandedEyebrow, { color: colors.textMuted }]}>

            {insight.title}

          </Text>

          <Ionicons name="chevron-up" size={14} color={colors.textMuted} style={styles.chevronMuted} />

        </Pressable>

        <InsightTipText text={insight.tip} color={colors.text} />

      </SurfaceCard>

    );

  }



  return (

    <GlassContainer

      padding={0}

      borderRadius={radius.lg}

      innerBackgroundColor={colors.surfaceElevated}

      style={[styles.collapsedShell, { borderColor: colors.border }]}

    >

      <Pressable

        onPress={toggle}

        style={({ pressed }) => [styles.collapsedRow, pressed && styles.collapsedRowPressed]}

        accessibilityRole="button"

        accessibilityLabel="Conseil IA"

        accessibilityHint={teaser}

        accessibilityState={{ expanded: false }}

      >

        <Ionicons name="sparkles-outline" size={11} color={accentColor} style={styles.collapsedSparkle} />

        <Text style={[styles.collapsedLabel, { color: colors.textMuted }]}>Conseil</Text>

        <Text style={[styles.collapsedTeaser, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">

          {teaser}

        </Text>

        <Ionicons name="chevron-down" size={12} color={colors.textMuted} style={styles.chevronMuted} />

      </Pressable>

    </GlassContainer>

  );

}



const styles = StyleSheet.create({

  collapsedShell: {

    alignSelf: 'stretch',

    borderWidth: StyleSheet.hairlineWidth,

    overflow: 'hidden',

  },

  collapsedRow: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: spacing.sm,

    paddingHorizontal: spacing.md,

    paddingVertical: spacing.sm + 2,

    minHeight: 34,

  },

  collapsedRowPressed: {

    opacity: 0.82,

  },

  collapsedSparkle: {

    flexShrink: 0,

  },

  collapsedLabel: {

    ...jakartaExtraBoldText,

    ...typographyKit.microMedium,

    flexShrink: 0,

    letterSpacing: 0.2,

  },

  collapsedTeaser: {

    ...typographyKit.metaMedium,

    flex: 1,

    minWidth: 0,

    fontSize: typography.meta - 1,

    lineHeight: typography.meta + 3,

  },

  chevronMuted: {

    opacity: 0.45,

    flexShrink: 0,

  },

  expandedHeaderRow: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: spacing.sm,

    minHeight: 36,

  },

  iconWell: {

    width: 26,

    height: 26,

    borderRadius: 13,

    borderWidth: StyleSheet.hairlineWidth,

    alignItems: 'center',

    justifyContent: 'center',

  },

  expandedEyebrow: {

    flex: 1,

    minWidth: 0,

  },

  tipText: {

    ...jakartaMediumText,

    ...typographyKit.metaMedium,

    lineHeight: typography.meta + 6,

    marginTop: spacing.sm,

  },

});


