import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { jakartaMediumText, jakartaRegularText, spacing } from '@/constants/theme';

import { AIWidgetRenderer } from '@/components/chat/AIWidgetRenderer';

import { stripCodeFromAssistantText } from '@/lib/ai/messageBlocks';

import type { MessageBlock } from '@/types/aiWidgets';

import { AIChatActionCard } from './AIChatActionCard';

import { WidgetContainer } from './WidgetContainer';

import { useAIChatColors, type AIChatColors } from './theme';

import type { AIChatUiMessage } from './types';



type Props = {

  message: AIChatUiMessage;

  onConfirmAction?: (messageId: string, actionKey: string) => void;

  onCancelAction?: (messageId: string, actionKey: string) => void;

  actionsDisabled?: boolean;

};



function formatTimestamp(createdAt: number): string {

  const date = new Date(createdAt);

  return date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false });

}



function ChatBubble({

  children,

  palette,

  style,

}: {

  children: React.ReactNode;

  palette: AIChatColors;

  style?: ViewStyle;

}) {

  return (

    <View style={[styles.chatBubbleWrapper, style]}>

      <View

        style={[

          styles.chatBubble,

          {

            backgroundColor: palette.aiBubble,

            borderColor: palette.border,

            shadowColor: palette.aiBubbleShadow,

            shadowOpacity: palette.aiBubbleShadowOpacity,

          },

        ]}

      >

        {children}

      </View>

    </View>

  );

}



function renderMessageBlock(block: MessageBlock, index: number, palette: AIChatColors) {

  if (block.type === 'text') {

    if (!block.content.trim()) return null;

    return (

      <ChatBubble key={`text-${index}`} palette={palette} style={index > 0 ? styles.blockSpacing : undefined}>

        <Text style={[styles.aiMessageText, { color: palette.text }, jakartaRegularText]}>

          {block.content}

        </Text>

      </ChatBubble>

    );

  }



  return (

    <View key={`widget-${block.type}-${index}`} style={styles.widgetBlock}>

      <AIWidgetRenderer data={block} />

    </View>

  );

}



function resolveAssistantBlocks(message: AIChatUiMessage): MessageBlock[] {

  if (message.blocks?.length) {

    return message.blocks;

  }

  const fallbackText = stripCodeFromAssistantText(message.text);

  return fallbackText ? [{ type: 'text', content: fallbackText }] : [];

}



export function AIChatMessage({

  message,

  onConfirmAction,

  onCancelAction,

  actionsDisabled = false,

}: Props) {

  const palette = useAIChatColors();

  const isUser = message.role === 'user';

  const assistantBlocks = !isUser ? resolveAssistantBlocks(message) : [];

  const hasBlocks = assistantBlocks.length > 0;

  const hasActions = Boolean(message.actions?.length);



  if (isUser) {

    return (

      <View style={styles.userMessageWrapper}>

        <View style={[styles.userBubble, { backgroundColor: palette.userBubble }]}>

          {message.imageUri ? (

            <Image source={{ uri: message.imageUri }} style={styles.attachedImage} resizeMode="cover" />

          ) : null}

          <Text style={[styles.userMessageText, { color: palette.userBubbleText }, jakartaMediumText]}>

            {message.text}

          </Text>

        </View>

        <Text style={[styles.timestamp, styles.timestampRight, { color: palette.textMuted }, jakartaRegularText]}>

          {formatTimestamp(message.createdAt)}

        </Text>

      </View>

    );

  }



  return (

    <View style={styles.aiMessageWrapper}>

      <View style={styles.messageContainer}>

        {assistantBlocks.map((block, index) => renderMessageBlock(block, index, palette))}

        {hasActions
          ? message.actions!.map((action, index) => (
              <WidgetContainer
                key={action.actionKey}
                style={
                  index > 0
                    ? styles.actionSiblingSpacing
                    : hasBlocks
                      ? undefined
                      : styles.noTopSpacing
                }
              >

                <AIChatActionCard

                  action={action}

                  disabled={actionsDisabled}

                  onConfirm={(actionKey) => onConfirmAction?.(message.id, actionKey)}

                  onCancel={(actionKey) => onCancelAction?.(message.id, actionKey)}

                />

              </WidgetContainer>

            ))

          : null}

      </View>

      <Text style={[styles.timestamp, { color: palette.textMuted }, jakartaRegularText]}>

        {formatTimestamp(message.createdAt)}

      </Text>

    </View>

  );

}



const styles = StyleSheet.create({

  aiMessageWrapper: {

    marginBottom: 20,

    width: '100%',

    alignSelf: 'flex-start',

  },

  messageContainer: {

    width: '100%',

    alignSelf: 'stretch',

  },

  chatBubbleWrapper: {

    maxWidth: '80%',

    alignSelf: 'flex-start',

  },

  chatBubble: {

    padding: 16,

    borderRadius: 20,

    borderBottomLeftRadius: 4,

    borderWidth: 1,

    shadowOffset: { width: 0, height: 2 },

    shadowRadius: 6,

    elevation: 2,

    gap: spacing.sm,

  },

  aiMessageText: {

    fontSize: 15,

    lineHeight: 22,

  },

  blockSpacing: {

    marginTop: spacing.sm,

  },

  widgetBlock: {

    width: '100%',

    marginTop: spacing.lg,

  },

  trailingSibling: {

    width: '100%',

    alignSelf: 'stretch',

  },

  trailingSpacing: {

    marginTop: spacing.lg,

  },

  actionSiblingSpacing: {

    marginTop: spacing.sm,

  },

  noTopSpacing: {

    marginTop: 0,

  },

  userMessageWrapper: {

    marginBottom: 20,

    maxWidth: '85%',

    alignSelf: 'flex-end',

  },

  userBubble: {

    padding: 16,

    borderRadius: 20,

    borderBottomRightRadius: 4,

    gap: 8,

  },

  attachedImage: {

    width: 180,

    height: 120,

    borderRadius: 12,

  },

  userMessageText: {

    fontSize: 15,

    lineHeight: 22,

  },

  timestamp: {

    fontSize: 11,

    marginTop: 6,

    marginHorizontal: 4,

  },

  timestampRight: {

    textAlign: 'right',

  },

});


