import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  interBoldText,
  interRegularText,
  interSemiboldText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';
import { SparklineChart } from './SparklineChart';
import { StockCard } from './StockCard';
import { SummaryCard } from './SummaryCard';
import type { ChatMessage, MessageContent } from './types';

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

function RichTextBlock({ text, color }: { text: string; color: string }) {
  const lines = text.split('\n');

  return (
    <View style={styles.richBlock}>
      {lines.map((line, lineIndex) => {
        const trimmed = line.trimStart();
        const isBullet = trimmed.startsWith('•');
        const content = isBullet ? trimmed.slice(1).trimStart() : line;
        const segments = parseRichText(content);

        return (
          <View key={`line-${lineIndex}`} style={[styles.richLine, isBullet && styles.bulletLine]}>
            {isBullet ? <Text style={[styles.bullet, { color }]}>•</Text> : null}
            <Text style={[styles.richText, { color }, interRegularText]}>
              {segments.map((segment, index) => (
                <Text
                  key={`seg-${lineIndex}-${index}`}
                  style={segment.bold ? [interBoldText, styles.boldNumbers] : undefined}
                >
                  {segment.text}
                </Text>
              ))}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ContentBlock({ content, isUser }: { content: MessageContent; isUser: boolean }) {
  const { colors, isLight } = useAppTheme();

  switch (content.kind) {
    case 'text':
      return (
        <Text
          style={[
            styles.plainText,
            { color: isUser ? (isLight ? '#FFFFFF' : '#0D1117') : colors.text },
            interRegularText,
          ]}
        >
          {content.text}
        </Text>
      );
    case 'rich':
      return <RichTextBlock text={content.text} color={colors.text} />;
    case 'stock':
      return <StockCard stock={content.stock} />;
    case 'sparkline':
      return (
        <View style={styles.sparklineBlock}>
          {content.caption ? (
            <Text style={[styles.sparklineCaption, { color: colors.textMuted }, interSemiboldText]}>
              {content.caption}
            </Text>
          ) : null}
          <SparklineChart data={content.data} />
        </View>
      );
    case 'summary':
      return <SummaryCard title={content.title} rows={content.rows} />;
    default:
      return null;
  }
}

type Props = {
  message: ChatMessage;
};

export function MessageBubble({ message }: Props) {
  const { colors, isLight } = useAppTheme();
  const isUser = message.role === 'user';

  const userBubbleColor = isLight ? 'rgba(0, 168, 84, 0.92)' : 'rgba(0, 230, 118, 0.18)';
  const assistantBubbleColor = colors.surfaceSolid;

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {isUser ? (
        <View
          style={[
            styles.bubble,
            styles.userBubble,
            {
              backgroundColor: userBubbleColor,
              borderColor: isLight ? 'transparent' : 'rgba(0, 230, 118, 0.28)',
            },
          ]}
        >
          {message.content.map((block, index) => (
            <Fragment key={`${message.id}-user-${index}`}>
              <ContentBlock content={block} isUser />
            </Fragment>
          ))}
        </View>
      ) : (
        <View style={styles.assistantStack}>
          {message.content.map((block, index) => {
            const isCard = block.kind === 'stock' || block.kind === 'summary' || block.kind === 'sparkline';

            if (isCard) {
              return (
                <View key={`${message.id}-card-${index}`} style={styles.cardWrapper}>
                  <ContentBlock content={block} isUser={false} />
                </View>
              );
            }

            return (
              <View
                key={`${message.id}-text-${index}`}
                style={[
                  styles.bubble,
                  styles.assistantBubble,
                  {
                    backgroundColor: assistantBubbleColor,
                    borderColor: isLight ? colors.border : colors.glassBorder,
                  },
                ]}
              >
                <ContentBlock content={block} isUser={false} />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const MESSAGE_GAP = spacing.sm;

const styles = StyleSheet.create({
  row: {
    paddingBottom: MESSAGE_GAP,
  },
  rowUser: {
    alignItems: 'flex-end',
  },
  rowAssistant: {
    alignItems: 'flex-start',
  },
  assistantStack: {
    maxWidth: '85%',
    gap: spacing.sm,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  userBubble: {
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomRightRadius: radius.sm,
  },
  assistantBubble: {
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: radius.sm,
  },
  cardWrapper: {
    width: '100%',
  },
  plainText: {
    fontSize: typography.body,
    lineHeight: typography.body + 6,
  },
  richBlock: {
    gap: spacing.xs,
  },
  richLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletLine: {
    paddingLeft: spacing.xs,
  },
  bullet: {
    ...interBoldText,
    fontSize: typography.body,
    lineHeight: typography.body + 6,
    marginRight: spacing.sm,
  },
  richText: {
    flex: 1,
    fontSize: typography.body,
    lineHeight: typography.body + 6,
  },
  boldNumbers: {
    letterSpacing: -0.2,
  },
  sparklineBlock: {
    gap: spacing.sm,
  },
  sparklineCaption: {
    fontSize: typography.meta,
    letterSpacing: 0.2,
  },
});
