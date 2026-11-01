/**
 * Dictée vocale d'une transaction (onglet Transactions, FAB commande vocale).
 *
 * Le micro s'active tout seul à l'ouverture et s'arrête quand tu as fini de parler
 * (détection adaptative dans `useVoiceCapture`). Pendant l'écoute, l'orbe respire avec ta
 * voix et un anneau se remplit pendant le silence final. Puis : « Voici ce que j'ai compris »
 * — montant, commerce, type / catégorie / compte en puces, ce qui manque en « + ».
 * Rien n'est enregistré sans confirmation : « Ajouter » ouvre le formulaire pré-rempli.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/components/BottomSheet';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { AppIcon } from '@/components/icons/AppIcon';
import { PressScale, Reveal } from '@/components/kit/motion';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { VoiceOrb } from '@/components/voice/VoiceOrb';
import { jakartaBoldText, jakartaMediumText, jakartaSemiboldText, moneyAmountTypography, spacing } from '@/constants/theme';
import { useVoiceCapture, type VoiceCaptureErrorKind } from '@/hooks/useVoiceCapture';
import { loadBudgetCategoriesForPicker } from '@/lib/budgetCategories';
import { formatDisplayMoneyAbsoluteExact } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { parseSpokenTransaction } from '@/lib/parseSpokenTransaction';
import { SHEET_HANDLE_DRAG_ZONE_HEIGHT } from '@/lib/sheet/useDraggableSheetGesture';
import { useAppTheme } from '@/lib/themeContext';
import type { Category, SimulatedAccount } from '@/types';

const EXAMPLE = '« 50 $ d’essence chez Petro-Canada »';
/** One height for every phase — the sheet never jumps. */
const SHEET_HEIGHT_RATIO = 0.52;

const ERROR_COPY: Record<VoiceCaptureErrorKind, { icon: string; title: string; message: string }> = {
  permission: { icon: 'mic-off-outline', title: 'Micro non autorisé', message: 'Autorise le micro dans les réglages de l’appareil.' },
  recording: { icon: 'mic-off-outline', title: 'Micro indisponible', message: 'L’enregistrement n’a pas démarré. Réessaie.' },
  'no-speech': { icon: 'volume-mute-outline', title: 'Je n’ai rien entendu', message: `Essaie par ex. ${EXAMPLE}.` },
  'no-api-key': { icon: 'key-outline', title: 'Clé Gemini absente', message: 'Ajoute ta clé API Gemini dans les réglages IA.' },
  network: { icon: 'cloud-offline-outline', title: 'Transcription impossible', message: 'Vérifie ta connexion puis réessaie.' },
};

type Props = {
  visible: boolean;
  onClose: () => void;
  accounts: readonly SimulatedAccount[];
  /** Marchands connus (catalogue + historique) pour la reconnaissance du commerce. */
  merchantNames: readonly string[];
};

export function VoiceTransactionSheet({ visible, onClose, accounts, merchantNames }: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { status, errorKind, transcript, level, silenceProgress, speechDetected, stop, retry, editTranscript } =
    useVoiceCapture(visible);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void loadBudgetCategoriesForPicker()
      .then((loaded) => !cancelled && setCategories(loaded))
      .catch(() => !cancelled && setCategories([]));
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (status !== 'ready') setEditing(false);
  }, [status]);

  const parsed = useMemo(
    () => parseSpokenTransaction(transcript, { accounts, categories, merchants: merchantNames }),
    [accounts, categories, merchantNames, transcript],
  );
  const category = useMemo(
    () => categories.find((c) => c.id === parsed.categoryId) ?? null,
    [categories, parsed.categoryId],
  );
  const understood = parsed.amount !== null || Boolean(parsed.merchant);

  const handleConfirm = useCallback(() => {
    tapHaptic();
    const params: Record<string, string> = { type: parsed.type };
    if (parsed.amount !== null) params.amount = String(parsed.amount);
    if (parsed.merchant) params.label = parsed.merchant;
    if (parsed.type === 'expense' && parsed.categoryId) params.categoryId = parsed.categoryId;
    if (parsed.accountId) params.accountId = parsed.accountId;
    onClose();
    router.push({ pathname: '/add-transaction', params });
  }, [onClose, parsed, router]);

  const handleRetry = useCallback(() => {
    tapHaptic();
    retry();
  }, [retry]);

  const handleClose = useCallback(() => {
    tapHaptic();
    onClose();
  }, [onClose]);

  const handle = (
    <View style={styles.handleBar}>
      <View style={[styles.handlePill, { backgroundColor: colors.borderStrong }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={14} onPress={handleClose} style={styles.close}>
        <AppIcon family="ionicons" name="close" size={22} color={colors.textMuted} />
      </Pressable>
    </View>
  );

  function renderListening() {
    const thinking = status === 'transcribing';
    const title = thinking ? 'Je comprends…' : status === 'starting' ? 'Un instant…' : speechDetected ? 'Je t’écoute…' : 'Parle naturellement';
    const hint = thinking
      ? 'Analyse de ce que tu viens de dire'
      : silenceProgress > 0
        ? 'Je termine…'
        : speechDetected
          ? 'Je m’arrête quand tu as fini'
          : `Par ex. ${EXAMPLE}`;
    return (
      <View style={styles.center}>
        <VoiceOrb mode={thinking ? 'thinking' : status === 'listening' ? 'listening' : 'idle'} level={level} silenceProgress={silenceProgress} />
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]} numberOfLines={2}>
          {hint}
        </Text>
        {status === 'listening' ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Terminer l’écoute"
            onPress={() => {
              tapHaptic();
              stop();
            }}
            scaleTo={0.95}
            style={[styles.secondaryPill, { backgroundColor: colors.surfaceElevated }]}
          >
            <View style={[styles.stopGlyph, { backgroundColor: colors.text }]} />
            <Text style={[styles.secondaryPillText, { color: colors.text }]}>Terminer</Text>
          </PressScale>
        ) : null}
      </View>
    );
  }

  function renderError(kind: VoiceCaptureErrorKind) {
    const copy = ERROR_COPY[kind];
    return (
      <View style={styles.center}>
        <View style={[styles.errorIcon, { backgroundColor: colors.surfaceElevated }]}>
          <AppIcon family="ionicons" name={copy.icon} size={28} color={colors.text} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]} numberOfLines={2}>
          {copy.message}
        </Text>
        <PrimarySaveButton label="Réessayer" onPress={handleRetry} style={styles.fullWidth} />
      </View>
    );
  }

  function renderTranscript() {
    return editing ? (
      <TextInput
        value={transcript}
        onChangeText={editTranscript}
        autoFocus
        onBlur={() => setEditing(false)}
        style={[styles.quoteInput, { color: colors.text, backgroundColor: colors.surfaceElevated }]}
        accessibilityLabel="Transcription — modifiable"
      />
    ) : (
      <Pressable accessibilityRole="button" accessibilityLabel="Modifier la transcription" onPress={() => setEditing(true)} hitSlop={6}>
        <Text style={[styles.quote, { color: colors.textMuted }]} numberOfLines={2}>
          « {transcript} »  <Text style={{ color: colors.textSecondary }}>Modifier</Text>
        </Text>
      </Pressable>
    );
  }

  function renderResult() {
    if (!understood) {
      return (
        <View style={styles.result}>
          <Text style={[styles.eyebrow, { color: colors.textMuted }]}>Je n’ai pas tout compris</Text>
          {renderTranscript()}
          <Text style={[styles.hint, styles.left, { color: colors.textMuted }]}>Il me faut au moins un montant ou un commerce.</Text>
          <View style={styles.actions}>
            <RetryButton onPress={handleRetry} />
            <PrimarySaveButton label="Remplir à la main" onPress={handleConfirm} style={styles.flex} />
          </View>
        </View>
      );
    }

    const chips: { key: string; label: string; icon?: React.ReactNode; missing?: boolean }[] = [
      { key: 'type', label: parsed.type === 'income' ? 'Revenu' : 'Dépense' },
    ];
    if (parsed.type === 'expense') {
      chips.push(
        category
          ? {
              key: 'category',
              label: category.name,
              icon: <BudgetCategoryIcon icon={category.icon} name={category.name} id={category.id} tint={colors.text} bare wellSize={16} glyphSize={13} />,
            }
          : { key: 'category', label: 'Catégorie', missing: true },
      );
    }
    chips.push(parsed.accountLabel ? { key: 'account', label: parsed.accountLabel } : { key: 'account', label: 'Compte', missing: true });

    return (
      <View style={styles.result}>
        <Text style={[styles.eyebrow, { color: colors.textMuted }]}>Voici ce que j’ai compris</Text>
        <Reveal>
          <Text style={[moneyAmountTypography({ tier: 'stat', fontSize: 34 }), { color: colors.text }]}>
            {parsed.amount !== null ? `${parsed.type === 'income' ? '+' : '−'}${formatDisplayMoneyAbsoluteExact(parsed.amount)}` : '— $'}
          </Text>
          <Text style={[styles.merchant, { color: parsed.merchant ? colors.text : colors.textMuted }]} numberOfLines={1}>
            {parsed.merchant ?? 'Commerce à préciser'}
          </Text>
        </Reveal>
        <Reveal index={1} style={styles.chips}>
          {chips.map((chip) => (
            <View
              key={chip.key}
              style={[
                styles.chip,
                chip.missing
                  ? { borderColor: colors.borderStrong, borderStyle: 'dashed', borderWidth: 1 }
                  : { backgroundColor: colors.surfaceElevated },
              ]}
            >
              {chip.missing ? <AppIcon family="ionicons" name="add" size={13} color={colors.textMuted} /> : chip.icon ?? null}
              <Text style={[styles.chipText, { color: chip.missing ? colors.textMuted : colors.text }]} numberOfLines={1}>
                {chip.label}
              </Text>
            </View>
          ))}
        </Reveal>
        {renderTranscript()}
        <View style={styles.actions}>
          <RetryButton onPress={handleRetry} />
          <PrimarySaveButton label="Ajouter" onPress={handleConfirm} style={styles.flex} />
        </View>
      </View>
    );
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      hideTitleRow
      handle={handle}
      heightRatio={SHEET_HEIGHT_RATIO}
      scrollable={false}
      sheetStyle={styles.sheet}
      scrollContentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.md,
        flex: 1,
        minHeight: SHEET_HANDLE_DRAG_ZONE_HEIGHT,
      }}
    >
      <View style={styles.body}>
        {status === 'error' && errorKind
          ? renderError(errorKind)
          : status === 'ready'
            ? renderResult()
            : renderListening()}
      </View>
    </BottomSheet>
  );
}

/** Round « Redire » mic button next to the primary action. */
function RetryButton({ onPress }: { onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel="Redire"
      onPress={onPress}
      scaleTo={0.92}
      style={[styles.retry, { backgroundColor: colors.surfaceElevated }]}
    >
      <AppIcon family="ionicons" name="mic" size={20} color={colors.text} />
    </PressScale>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingBottom: 0 },
  handleBar: { alignSelf: 'stretch', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  handlePill: { width: 36, height: 4, borderRadius: 2 },
  close: { position: 'absolute', right: spacing.lg, top: '50%', marginTop: -11 },
  body: { flex: 1, minHeight: 0, justifyContent: 'center' },
  center: { alignItems: 'center', gap: spacing.sm },
  title: { ...jakartaBoldText, fontSize: 20, letterSpacing: -0.3, textAlign: 'center', marginTop: spacing.sm },
  hint: { ...jakartaMediumText, fontSize: 13.5, lineHeight: 19, textAlign: 'center', paddingHorizontal: spacing.md },
  left: { textAlign: 'left', paddingHorizontal: 0 },
  secondaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    marginTop: spacing.sm,
  },
  secondaryPillText: { ...jakartaSemiboldText, fontSize: 13.5 },
  stopGlyph: { width: 10, height: 10, borderRadius: 2 },
  errorIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  fullWidth: { alignSelf: 'stretch', marginTop: spacing.md },

  result: { gap: spacing.md },
  eyebrow: { ...jakartaSemiboldText, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  merchant: { ...jakartaSemiboldText, fontSize: 17, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 11, borderRadius: 15, maxWidth: '100%' },
  chipText: { ...jakartaSemiboldText, fontSize: 12.5, flexShrink: 1 },
  quote: { ...jakartaMediumText, fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
  quoteInput: { ...jakartaMediumText, fontSize: 14, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  retry: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
