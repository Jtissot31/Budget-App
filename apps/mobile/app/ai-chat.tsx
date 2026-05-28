import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { radius, spacing, typography } from '@/constants/theme';
import { getDashboard, getSavingsGoals, getSimulatedAccounts } from '@/lib/db';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type { DashboardSummary, SavingsGoal, SimulatedAccount } from '@/types';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

const AI_SEND_BLUE = '#2563EB';

type SuggestedQuestion = {
  label: string;
  message: string;
};

const SUGGESTED_QUESTIONS: readonly SuggestedQuestion[] = [
  {
    label: 'Bilan finances',
    message: "Tu peux me faire un bilan de où j'en suis avec mon argent ?",
  },
  {
    label: 'Grosses dépenses',
    message: "C'est quoi mes plus grosses dépenses ce mois-ci ?",
  },
  {
    label: 'Budget OK ?',
    message: 'Est-ce que je respecte mon budget ou je suis en train de déraper ?',
  },
  {
    label: 'Reste à dépenser',
    message: "Il me reste combien à dépenser d'ici la fin du mois ?",
  },
  {
    label: 'Compte le plus serré',
    message: 'Quel compte est le plus serré en ce moment ?',
  },
  {
    label: 'Dépenser moins',
    message: "J'ai besoin d'idées pour dépenser moins — par où je commence ?",
  },
  {
    label: 'Mes objectifs',
    message: "Où en suis-je avec mes objectifs d'épargne ?",
  },
];

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size) as T[]);
  }
  return rows;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: "Salut ! Je suis là pour t'aider à y voir clair — budget, dépenses, épargne. Pose-moi ce qui te tracasse ou choisis une question ci-dessous.",
};

type ChatContext = {
  dashboard: DashboardSummary | null;
  accounts: SimulatedAccount[];
  goals: SavingsGoal[];
};

function formatCurrency(value: number) {
  return value.toLocaleString('fr-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function normalizeQuestion(text: string) {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isFinanceReviewQuestion(q: string) {
  return (
    (q.includes('revue') && q.includes('finance')) ||
    (q.includes('bilan') && (q.includes('argent') || q.includes('finance') || q.includes('en suis')))
  );
}

function isTopSpendingQuestion(q: string) {
  return (
    q.includes('depense le plus') ||
    q.includes('depenser le plus') ||
    q.includes('grosses depenses') ||
    (q.includes('depense') && q.includes('gros'))
  );
}

function isBudgetTrackQuestion(q: string) {
  return (
    q.includes('bonne voie') ||
    (q.includes('budget') && q.includes('voie')) ||
    q.includes('derap') ||
    (q.includes('budget') && q.includes('respecte'))
  );
}

function isTightAccountQuestion(q: string) {
  return q.includes('compte') && (q.includes('marge') || q.includes('serre'));
}

function isSpendingTipsQuestion(q: string) {
  return (
    q.includes('reduire') ||
    q.includes('conseil') ||
    q.includes('depenser moins') ||
    q.includes('idee')
  );
}

function buildAssistantReply(ctx: ChatContext, userText: string): string {
  const trimmed = userText.trim();
  if (!trimmed) {
    return "Dis-moi ce qui t'intéresse — budget, dépenses, épargne — et on regarde ça ensemble.";
  }

  const q = normalizeQuestion(trimmed);
  const { dashboard, accounts, goals } = ctx;

  if (isFinanceReviewQuestion(q)) {
    if (!dashboard) {
      return "Pour te faire un vrai bilan, j'ai besoin de quelques transactions dans l'app. Une fois que c'est fait, reviens me voir — je pourrai te dire où tu en es.";
    }

    const { monthlyExpenses, monthlyBudgetLimit, monthlyIncome, balance } = dashboard;
    const remaining = Math.max(0, monthlyBudgetLimit - monthlyExpenses);
    const budgetPct =
      monthlyBudgetLimit > 0 ? Math.round((monthlyExpenses / monthlyBudgetLimit) * 100) : 0;

    const lines: string[] = ["Voici ce que je vois pour toi en ce moment."];

    if (budgetPct >= 90) {
      lines.push(
        `Côté budget, c'est serré : tu as déjà dépensé ${formatCurrency(monthlyExpenses)} $ sur ${formatCurrency(monthlyBudgetLimit)} $ (${budgetPct} %). Il te reste environ ${formatCurrency(remaining)} $ d'ici la fin du mois.`,
      );
    } else if (budgetPct >= 70) {
      lines.push(
        `Tu as utilisé ${budgetPct} % de ton budget (${formatCurrency(monthlyExpenses)} $ sur ${formatCurrency(monthlyBudgetLimit)} $). Il reste environ ${formatCurrency(remaining)} $ — ça se tient, mais garde un œil dessus.`,
      );
    } else {
      lines.push(
        `Bonne nouvelle côté budget : ${formatCurrency(monthlyExpenses)} $ dépensés sur ${formatCurrency(monthlyBudgetLimit)} $ (${budgetPct} %). Il te reste environ ${formatCurrency(remaining)} $ pour finir le mois.`,
      );
    }

    if (monthlyIncome > 0) {
      lines.push(`Tes revenus du mois tournent autour de ${formatCurrency(monthlyIncome)} $.`);
    }

    lines.push(`Ton solde net est à ${formatCurrency(balance)} $.`);

    if (dashboard.topBudgets?.length) {
      const top = [...dashboard.topBudgets].sort((a, b) => b.spent - a.spent)[0];
      if (top && top.spent > 0) {
        lines.push(
          `Là où ça part le plus, c'est ${top.categoryName} — ${formatCurrency(top.spent)} $ ce mois-ci.`,
        );
      }
    }

    const visibleAccounts = accounts.filter((a) => !a.hidden);
    if (visibleAccounts.length) {
      const totalBalance = visibleAccounts.reduce((sum, a) => sum + a.balance, 0);
      lines.push(
        `Tu as ${visibleAccounts.length} compte${visibleAccounts.length > 1 ? 's' : ''} visible${visibleAccounts.length > 1 ? 's' : ''}, pour un total d'environ ${formatCurrency(totalBalance)} $.`,
      );
    }

    if (goals.length) {
      const onTrack = goals.filter(
        (g) => g.targetAmount > 0 && g.currentAmount / g.targetAmount >= 0.5,
      ).length;
      lines.push(
        `Côté épargne, tu as ${goals.length} objectif${goals.length > 1 ? 's' : ''} — ${onTrack} ${onTrack > 1 ? 'sont' : 'est'} déjà à mi-chemin ou plus.`,
      );
    }

    return lines.join('\n\n');
  }

  if (isTopSpendingQuestion(q)) {
    if (dashboard?.topBudgets?.length) {
      const top = [...dashboard.topBudgets].sort((a, b) => b.spent - a.spent)[0];
      if (top && top.spent > 0) {
        return `Bonne question. Ce mois-ci, ce qui te coûte le plus, c'est ${top.categoryName} — ${formatCurrency(top.spent)} $ (sur un budget de ${formatCurrency(top.limitAmount)} $ pour cette catégorie).`;
      }
    }
    return "Pour l'instant, je n'ai pas assez de dépenses catégorisées pour te pointer un gros poste. Ajoute quelques transactions et on pourra regarder ça de plus près.";
  }

  if (isBudgetTrackQuestion(q)) {
    if (dashboard) {
      const { monthlyExpenses, monthlyBudgetLimit } = dashboard;
      const remaining = Math.max(0, monthlyBudgetLimit - monthlyExpenses);
      const ratio = monthlyBudgetLimit > 0 ? monthlyExpenses / monthlyBudgetLimit : 0;
      if (ratio >= 0.9) {
        return `Pas de panique — mais oui, tu touches au plafond. Tu as dépensé ${formatCurrency(monthlyExpenses)} $ sur ${formatCurrency(monthlyBudgetLimit)} $. Il reste environ ${formatCurrency(remaining)} $ : c'est le moment de faire attention aux achats non essentiels.`;
      }
      if (ratio >= 0.7) {
        return `Tu es à ${Math.round(ratio * 100)} % de ton budget (${formatCurrency(monthlyExpenses)} $ sur ${formatCurrency(monthlyBudgetLimit)} $). Il te reste ${formatCurrency(remaining)} $ — tu n'as pas dérapé, mais la marge se rétrécit.`;
      }
      return `Oui, tu respectes ton budget pour l'instant — ${Math.round(ratio * 100)} % utilisé, avec ${formatCurrency(remaining)} $ encore disponibles. Continue sur cette lancée !`;
    }
  }

  if (isTightAccountQuestion(q)) {
    const visible = accounts.filter((a) => !a.hidden);
    if (visible.length) {
      const withMargin = visible.map((a) => {
        const limit = a.creditLimit ?? 0;
        const margin = a.kind === 'credit' && limit > 0 ? limit - Math.abs(a.balance) : a.balance;
        return { account: a, margin };
      });
      const tightest = withMargin.sort((a, b) => a.margin - b.margin)[0];
      if (tightest) {
        const { account, margin } = tightest;
        if (account.kind === 'credit' && (account.creditLimit ?? 0) > 0) {
          return `Voici ce que je vois : c'est ${account.name} qui est le plus serré — environ ${formatCurrency(Math.max(0, margin))} $ de marge sur une limite de ${formatCurrency(account.creditLimit ?? 0)} $.`;
        }
        return `Pour l'instant, c'est ${account.name} qui a le solde le plus bas parmi tes comptes visibles (${formatCurrency(account.balance)} $).`;
      }
    }
    return "Ajoute tes comptes dans Portefeuille et je pourrai te dire lequel est le plus serré en ce moment.";
  }

  if (q.includes('reste') && (q.includes('depenser') || q.includes('depense'))) {
    if (dashboard) {
      const remaining = Math.max(0, dashboard.monthlyBudgetLimit - dashboard.monthlyExpenses);
      return `D'ici la fin du mois, tu peux encore dépenser environ ${formatCurrency(remaining)} $ — sur un budget de ${formatCurrency(dashboard.monthlyBudgetLimit)} $, tu en as déjà utilisé ${formatCurrency(dashboard.monthlyExpenses)} $.`;
    }
  }

  if (isSpendingTipsQuestion(q)) {
    const tips = [
      'Repère tes 2–3 catégories les plus dépensées et fixe-toi un plafond par semaine.',
      'Avant un achat impulsif, attends 24 h — souvent l\'envie passe.',
      'Jette un œil à tes paiements récurrents : un abonnement oublié, ça s\'additionne vite.',
    ];
    if (dashboard && dashboard.topBudgets.length) {
      const top = [...dashboard.topBudgets].sort((a, b) => b.spent - a.spent)[0];
      if (top?.spent > 0) {
        return `Bonne idée de vouloir dépenser moins. Par où commencer ? ${tips[0]} Chez toi, je commencerais par ${top.categoryName} (${formatCurrency(top.spent)} $ ce mois-ci). ${tips[1]}`;
      }
    }
    return `Bonne idée de vouloir dépenser moins. Voici trois pistes simples :\n\n${tips.map((t) => `• ${t}`).join('\n')}`;
  }

  if (q.includes('objectif') || q.includes('epargne')) {
    if (goals.length) {
      const lines = goals.slice(0, 4).map((g) => {
        const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
        return `• ${g.name} : ${formatCurrency(g.currentAmount)} $ sur ${formatCurrency(g.targetAmount)} $ (${pct} %)`;
      });
      return `Voici où tu en es avec tes objectifs :\n\n${lines.join('\n')}`;
    }
    return "Tu n'as pas encore d'objectifs d'épargne dans l'app — crée-en un dans l'onglet Objectifs et on pourra suivre ta progression ensemble.";
  }

  if (dashboard) {
    const { monthlyExpenses, monthlyBudgetLimit, balance, monthlyIncome } = dashboard;
    const budgetRatio = monthlyBudgetLimit > 0 ? monthlyExpenses / monthlyBudgetLimit : 0;

    if (budgetRatio >= 0.9) {
      const remaining = Math.max(0, monthlyBudgetLimit - monthlyExpenses);
      return `Pas de panique — tu es proche du plafond (${formatCurrency(monthlyExpenses)} $ sur ${formatCurrency(monthlyBudgetLimit)} $). Il reste environ ${formatCurrency(remaining)} $ : on peut regarder ensemble ce qu'il vaut la peine de reporter.`;
    }

    if (balance < 0) {
      return `Je vois un solde net à ${formatCurrency(balance)} $. Ce n'est pas idéal, mais on peut s'y prendre étape par étape : commence par les paiements essentiels et repasse tes abonnements récurrents.`;
    }

    if (monthlyIncome > 0 && monthlyExpenses > monthlyIncome * 0.85) {
      return `Tes dépenses (${formatCurrency(monthlyExpenses)} $) se rapprochent de tes revenus (${formatCurrency(monthlyIncome)} $). Garde un peu de marge pour l'épargne si tu peux — ça fait une vraie différence sur la durée.`;
    }
  }

  return "Je n'ai pas tout à fait saisi ta question, mais je suis là. Tu peux me parler de ton budget, de tes dépenses ou de ton épargne — ou choisir une suggestion ci-dessous.";
}

export default function AiChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const styles = useMemo(() => createStyles(), []);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [chatContext, setChatContext] = useState<ChatContext>({
    dashboard: null,
    accounts: [],
    goals: [],
  });

  useEffect(() => {
    void Promise.all([getDashboard(), getSimulatedAccounts(), getSavingsGoals()])
      .then(([dashboard, accounts, goals]) => {
        setChatContext({ dashboard, accounts, goals });
      })
      .catch(() => {
        setChatContext({ dashboard: null, accounts: [], goals: [] });
      });
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
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
      if (!text || sending) return;

      tapHaptic();
      setSending(true);
      if (!rawText) setInput('');

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text,
      };

      setMessages((prev) => [...prev, userMessage]);
      scrollToEnd();

      const replyText = buildAssistantReply(chatContext, text);
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            text: replyText,
          },
        ]);
        setSending(false);
        scrollToEnd();
      }, 500);
    },
    [chatContext, input, scrollToEnd, sending],
  );

  const handleVoicePress = useCallback(() => {
    tapHaptic();
    Alert.alert(
      'Saisie vocale',
      'Fonctionnalité vocale bientôt disponible.',
      [{ text: 'OK' }],
    );
  }, []);

  const handleChipPress = useCallback(
    (message: string) => {
      if (sending) return;
      sendMessage(message);
    },
    [sendMessage, sending],
  );

  const canSend = input.trim().length > 0 && !sending;

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior="padding"
    >
      <View style={[styles.header, { paddingTop: insets.top + SCREEN_TOP_GUTTER }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={12}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: colors.surfaceSolid, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Conseiller</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={scrollToEnd}
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          const isWelcome = item.id === 'welcome';
          return (
            <>
              <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
                <View
                  style={[
                    styles.bubble,
                    isUser
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.surfaceElevated },
                  ]}
                >
                  <Text style={[styles.bubbleText, { color: isUser ? (isLight ? '#FFFFFF' : '#0F172A') : colors.text }]}>
                    {item.text}
                  </Text>
                </View>
              </View>
              {isWelcome && !keyboardVisible ? (
                <View style={styles.chipsGrid}>
                  {chunk(SUGGESTED_QUESTIONS, 2).map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.chipRow}>
                      {row.map((question) => (
                        <Pressable
                          key={question.label}
                          accessibilityRole="button"
                          accessibilityLabel={question.message}
                          disabled={sending}
                          style={({ pressed }) => [
                            styles.chip,
                            {
                              backgroundColor: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
                              borderColor: colors.cardBorder,
                            },
                            pressed && styles.pressed,
                            sending && styles.chipDisabled,
                          ]}
                          onPress={() => handleChipPress(question.message)}
                        >
                          <Text
                            style={[styles.chipText, { color: colors.textMuted }]}
                            numberOfLines={2}
                          >
                            {question.label}
                          </Text>
                        </Pressable>
                      ))}
                      {row.length === 1 ? <View style={styles.chipSpacer} /> : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          );
        }}
      />

      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.surfaceSolid,
            paddingBottom: Math.max(insets.bottom, spacing.sm),
          },
        ]}
      >
        <View style={styles.inputRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Saisie vocale"
            style={({ pressed }) => [
              styles.micButton,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.cardBorder },
              pressed && styles.pressed,
            ]}
            onPress={handleVoicePress}
          >
            <Ionicons name="mic-outline" size={22} color={colors.textMuted} />
          </Pressable>

          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceElevated,
                color: colors.text,
                borderColor: colors.cardBorder,
              },
            ]}
            placeholder="Pose une question…"
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            editable={!sending}
            returnKeyType="send"
            blurOnSubmit={false}
            onFocus={() => setKeyboardVisible(true)}
            onSubmitEditing={() => sendMessage()}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Envoyer"
            style={({ pressed }) => [
              styles.sendButton,
              { backgroundColor: AI_SEND_BLUE },
              (pressed || sending) && styles.pressed,
              !canSend && styles.sendDisabled,
            ]}
            onPress={() => sendMessage()}
            disabled={!canSend}
          >
            <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles() {
  return StyleSheet.create({
    screen: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: typography.screenTitle,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    headerSpacer: { width: 40 },
    list: { flex: 1 },
    listContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      gap: spacing.sm,
    },
    bubbleRow: { flexDirection: 'row' },
    bubbleRowUser: { justifyContent: 'flex-end' },
    bubbleRowAssistant: { justifyContent: 'flex-start' },
    bubble: {
      maxWidth: '82%',
      borderRadius: radius.xl,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    bubbleText: {
      fontSize: typography.body,
      lineHeight: typography.body + 6,
    },
    footer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: spacing.sm,
    },
    chipsGrid: {
      marginTop: spacing.xs,
    },
    chipRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    chip: {
      flex: 1,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      paddingVertical: spacing.xs + 1,
      paddingHorizontal: spacing.sm + 2,
      alignItems: 'stretch',
      justifyContent: 'center',
    },
    chipSpacer: { flex: 1 },
    chipText: {
      fontSize: typography.meta,
      lineHeight: typography.meta + 4,
      textAlign: 'left',
    },
    chipDisabled: { opacity: 0.5 },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    micButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 0,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: typography.body,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendDisabled: { opacity: 0.45 },
    pressed: { opacity: 0.78 },
  });
}
