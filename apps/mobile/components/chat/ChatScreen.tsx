import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PAGE_PADDING_HORIZONTAL, spacing } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { ChatHeader } from './ChatHeader';
import { EmptyState } from './EmptyState';
import { InputBar } from './InputBar';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { createUserMessage, simulateAgentResponse } from './mockAgent';
import {
  EMPTY_STATE_SUGGESTIONS,
  QUICK_SUGGESTIONS,
  type ChatMessage,
} from './types';

type ListItem =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'typing' };

/** Breathing room between last message and the input bar (sibling layout, not overlay). */
const LIST_BOTTOM_GAP = spacing.md;

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ListItem>>(null);
  const pendingResponseRef = useRef<{ cancel: () => void } | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isResponding, setIsResponding] = useState(false);

  useEffect(() => {
    return () => {
      pendingResponseRef.current?.cancel();
    };
  }, []);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const sendMessage = useCallback(
    (rawText?: string) => {
      const text = (rawText ?? input).trim();
      if (!text || isResponding) return;

      tapHaptic();
      if (!rawText) setInput('');
      Keyboard.dismiss();

      const userMessage = createUserMessage(text);
      setMessages((prev) => [...prev, userMessage]);
      setIsResponding(true);
      scrollToEnd();

      pendingResponseRef.current?.cancel();
      pendingResponseRef.current = simulateAgentResponse(text, (assistantMessage) => {
        setMessages((prev) => [...prev, assistantMessage]);
        setIsResponding(false);
        pendingResponseRef.current = null;
        scrollToEnd();
      });
    },
    [input, isResponding, scrollToEnd],
  );

  const listData: ListItem[] = [
    ...messages.map((message) => ({ kind: 'message' as const, message })),
    ...(isResponding ? [{ kind: 'typing' as const }] : []),
  ];

  const showEmptyState = messages.length === 0 && !isResponding;

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['left', 'right']}
    >
      <ChatHeader status={isResponding ? 'thinking' : 'online'} topInset={insets.top} />

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.body}>
          {showEmptyState ? (
            <EmptyState
              suggestions={EMPTY_STATE_SUGGESTIONS}
              onSuggestionPress={sendMessage}
              disabled={isResponding}
            />
          ) : (
            <FlatList
              ref={listRef}
              data={listData}
              inverted={false}
              keyExtractor={(item) =>
                item.kind === 'typing' ? 'typing-indicator' : item.message.id
              }
              style={styles.list}
              contentContainerStyle={[
                styles.listContent,
                listData.length > 0 && styles.listContentGrow,
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              removeClippedSubviews={Platform.OS === 'android'}
              onContentSizeChange={scrollToEnd}
              renderItem={({ item }) => {
                if (item.kind === 'typing') {
                  return <TypingIndicator />;
                }
                return <MessageBubble message={item.message} />;
              }}
            />
          )}
        </View>

        <InputBar
          value={input}
          onChangeText={setInput}
          onSend={() => sendMessage()}
          onSuggestionPress={sendMessage}
          suggestions={QUICK_SUGGESTIONS}
          disabled={isResponding}
          bottomInset={insets.bottom}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  keyboardAvoid: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  body: {
    flex: 1,
    minHeight: 0,
    backgroundColor: 'transparent',
  },
  list: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    paddingTop: spacing.sm,
    paddingBottom: LIST_BOTTOM_GAP,
  },
  listContentGrow: {
    flexGrow: 1,
  },
});
