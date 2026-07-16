import { useCallback, useEffect, useRef, useState } from 'react';

import {

  FlatList,

  Keyboard,

  KeyboardAvoidingView,

  Platform,

  StyleSheet,

  Text,

  View,

} from 'react-native';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PAGE_PADDING_HORIZONTAL, radius, spacing, typography } from '@/constants/theme';

import { tapHaptic } from '@/lib/haptics';

import { useAppTheme } from '@/lib/themeContext';

import {
  loadChatHistory,
  sendChatMessage,
} from '@/lib/ai/chatService';
import { isFynChatApiKeyConfigured } from '@/lib/ai/env';

import { aiMessageToUi, createUiUserMessage } from '@/lib/ai/chatUiAdapter';

import { ChatHeader } from './ChatHeader';

import { EmptyState } from './EmptyState';

import { InputBar } from './InputBar';

import { MessageBubble } from './MessageBubble';

import { TypingIndicator } from './TypingIndicator';

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

  const { colors } = useAppTheme();

  const listRef = useRef<FlatList<ListItem>>(null);

  const requestRef = useRef(0);



  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [input, setInput] = useState('');

  const [isResponding, setIsResponding] = useState(false);

  const [offlineMode, setOfflineMode] = useState(() => !isFynChatApiKeyConfigured());

  const [historyLoaded, setHistoryLoaded] = useState(false);



  useEffect(() => {

    let cancelled = false;

    void (async () => {

      const [history] = await Promise.all([loadChatHistory()]);

      if (cancelled) return;

      setMessages(history.map(aiMessageToUi));

      setOfflineMode(!isFynChatApiKeyConfigured());

      setHistoryLoaded(true);

    })();

    return () => {

      cancelled = true;

    };

  }, []);



  const scrollToEnd = useCallback(() => {

    requestAnimationFrame(() => {

      listRef.current?.scrollToEnd({ animated: true });

    });

  }, []);



  const sendMessage = useCallback(

    async (rawText?: string) => {

      const text = (rawText ?? input).trim();

      if (!text || isResponding) return;



      tapHaptic();

      if (!rawText) setInput('');

      Keyboard.dismiss();



      const optimisticUser = createUiUserMessage(text);

      setMessages((prev) => [...prev, optimisticUser]);

      setIsResponding(true);

      scrollToEnd();



      const requestId = requestRef.current + 1;

      requestRef.current = requestId;



      try {

        const result = await sendChatMessage(text);

        if (requestRef.current !== requestId) return;



        setOfflineMode(result.offlineMode);

        setMessages((prev) => {

          const withoutOptimistic = prev.filter((message) => message.id !== optimisticUser.id);

          return [

            ...withoutOptimistic,

            aiMessageToUi(result.userMessage),

            aiMessageToUi(result.assistantMessage),

          ];

        });

      } catch {

        if (requestRef.current !== requestId) return;

        setMessages((prev) => [

          ...prev.filter((message) => message.id !== optimisticUser.id),

          optimisticUser,

          {

            id: `assistant-error-${Date.now()}`,

            role: 'assistant',

            content: [

              {

                kind: 'rich',

                text: 'Impossible d\'envoyer le message pour le moment. Réessaie dans un instant.',

              },

            ],

            createdAt: Date.now(),

          },

        ]);

      } finally {

        if (requestRef.current === requestId) {

          setIsResponding(false);

          scrollToEnd();

        }

      }

    },

    [input, isResponding, scrollToEnd],

  );



  const listData: ListItem[] = [

    ...messages.map((message) => ({ kind: 'message' as const, message })),

    ...(isResponding ? [{ kind: 'typing' as const }] : []),

  ];



  const showEmptyState = historyLoaded && messages.length === 0 && !isResponding;



  return (

    <SafeAreaView

      style={styles.screen}

      edges={['left', 'right']}

    >

      <ChatHeader status={isResponding ? 'thinking' : 'online'} topInset={insets.top} />



      {offlineMode ? (

        <View style={[styles.banner, { backgroundColor: colors.warningMuted, borderColor: colors.warning }]}>

          <Text style={[styles.bannerText, { color: colors.text }]}>

            Clé API absente — copie .env.example vers .env, ajoute EXPO_PUBLIC_GEMINI_API_KEY, puis redémarre Expo (npx expo start -c).

          </Text>

        </View>

      ) : null}



      <KeyboardAvoidingView

        style={styles.keyboardAvoid}

        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}

        keyboardVerticalOffset={0}

      >

        <View style={styles.body}>

          {showEmptyState ? (

            <EmptyState

              suggestions={EMPTY_STATE_SUGGESTIONS}

              onSuggestionPress={(message) => void sendMessage(message)}

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

          onSend={() => void sendMessage()}

          onSuggestionPress={(message) => void sendMessage(message)}

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

  banner: {

    marginHorizontal: PAGE_PADDING_HORIZONTAL,

    marginBottom: spacing.sm,

    borderRadius: radius.md,

    borderWidth: StyleSheet.hairlineWidth,

    paddingHorizontal: spacing.md,

    paddingVertical: spacing.sm,

  },

  bannerText: {

    fontSize: typography.meta,

    lineHeight: typography.meta + 4,

    textAlign: 'center',

  },

});


