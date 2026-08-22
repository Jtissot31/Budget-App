/**
 * Dictée vocale d'une transaction (onglet Transactions, FAB commande vocale).
 *
 * Le micro s'active **tout seul** à l'ouverture : permission → enregistrement
 * `expo-audio` → transcription Gemini (`useVoiceCapture`). Tout fonctionne dans
 * Expo Go, sans module natif de reconnaissance vocale.
 *
 * Le transcript est analysé par `parseSpokenTransaction`, puis affiché en récap.
 * Le type (dépense / revenu) est déduit automatiquement — pas de toggle. Rien n'est
 * enregistré sans confirmation : Confirmer ouvre le formulaire d'ajout pré-rempli.
 *
 * Hauteurs : ~1/3 pendant l'écoute ; ~0.45 une fois la transcription / le récap
 * prêts, pour afficher les données sans les compacter.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/components/BottomSheet';
import { AppIcon } from '@/components/icons/AppIcon';
import { OnyxContainer } from '@/components/OnyxContainer';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { VoiceListeningWave } from '@/components/voice/VoiceListeningWave';
import { ONYX_CONTAINER } from '@/constants/planFinanceKit';
import {
  jakartaExtraBoldText,
  jakartaMediumText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { useVoiceCapture, type VoiceCaptureErrorKind } from '@/hooks/useVoiceCapture';
import { loadBudgetCategoriesForPicker } from '@/lib/budgetCategories';
import { formatDisplayMoneyAbsoluteExact } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { parseSpokenTransaction } from '@/lib/parseSpokenTransaction';
import { SHEET_HANDLE_DRAG_ZONE_HEIGHT } from '@/lib/sheet/useDraggableSheetGesture';
import { useAppTheme } from '@/lib/themeContext';
import type { Category, SimulatedAccount } from '@/types';

const DICTATION_EXAMPLE = "« 50$ d'essence chez Petro-Canada »";

/**
 * Pendant l'écoute / démarrage : tiers bas — l'historique reste visible au-dessus.
 */
const SHEET_LISTENING_HEIGHT_RATIO = 1 / 3;
/**
 * Après capture (transcription + récap / erreur de parsing) : un peu plus haut
 * pour aérer titre, transcript, résumé et CTA sans scroll.
 */
const SHEET_RECAP_HEIGHT_RATIO = 0.45;
/** Poignée + X fermer (dans la zone de drag) — pas de titleRow BottomSheet. */
const SHEET_CHROME_HEIGHT = SHEET_HANDLE_DRAG_ZONE_HEIGHT;
/** Bouton X — même gabarit que PaymentDetailSheet / SettingsPickerSheet. */
const CLOSE_BUTTON_SIZE = 34;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const ERROR_COPY: Record<VoiceCaptureErrorKind, { title: string; message: string }> = {
  permission: {
    title: 'Micro non autorisé',
    message: "Autorise l'accès au microphone dans les réglages de l'appareil.",
  },
  recording: {
    title: 'Micro indisponible',
    message: "L'enregistrement n'a pas pu démarrer. Réessaie dans un instant.",
  },
  'no-speech': {
    title: "Je n'ai rien entendu",
    message: `Parle plus près du micro, par ex. ${DICTATION_EXAMPLE}.`,
  },
  'no-api-key': {
    title: 'Clé Gemini absente',
    message: 'Ajoute ta clé API Gemini dans les réglages IA.',
  },
  network: {
    title: 'Transcription impossible',
    message: 'Vérifie ta connexion internet puis réessaie.',
  },
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
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const {
    status,
    errorKind,
    transcript,
    level,
    durationMillis,
    silenceAutoStop,
    stop,
    retry,
    editTranscript,
  } = useVoiceCapture(visible);

  const [categories, setCategories] = useState<Category[]>([]);

  /** Écoute compacte ; remonte dès la transcription / le récap. */
  const isRecapPhase =
    status === 'transcribing' || status === 'ready' || (status === 'error' && errorKind != null);
  const heightRatio = isRecapPhase ? SHEET_RECAP_HEIGHT_RATIO : SHEET_LISTENING_HEIGHT_RATIO;
  const sheetMaxHeight = Math.round(windowHeight * heightRatio);
  /**
   * Contenu au-dessus de la nav système. Pendant l'écoute : safe area + `spacing.lg`
   * pour que « Touche pour arrêter. » ne soit pas rogné sous la barre de navigation.
   */
  const safeBottomPad = Math.max(insets.bottom, spacing.sm);
  const bodyBottomPadding = isRecapPhase ? safeBottomPad : safeBottomPad + spacing.lg;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void loadBudgetCategoriesForPicker()
      .then((loaded) => {
        if (!cancelled) setCategories(loaded);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const parsed = useMemo(
    () => parseSpokenTransaction(transcript, { accounts, categories, merchants: merchantNames }),
    [accounts, categories, merchantNames, transcript],
  );

  /** Type déduit par le parseur — pas de override UI. */
  const inferredType = parsed.type;

  const matchedCategory = useMemo(
    () => categories.find((category) => category.id === parsed.categoryId) ?? null,
    [categories, parsed.categoryId],
  );

  const understood = parsed.amount !== null || Boolean(parsed.merchant);

  /** Place restante pour l'état actif — tout doit y tenir sans scroll. */
  const contentRoom = Math.max(
    96,
    sheetMaxHeight - SHEET_CHROME_HEIGHT - bodyBottomPadding,
  );
  const haloSize = clamp(Math.round(contentRoom * 0.28), 48, 64);
  const stopSize = clamp(Math.round(contentRoom * 0.2), 40, 48);
  /**
   * Hauteur estimée du stack écoute (halo → stop). Si la hint ne rentre pas
   * dans le tiers restant, on la masque plutôt que de la rogner.
   */
  const listeningHintLineHeight = typography.meta + 4;
  const listeningCoreHeight =
    haloSize +
    spacing.xs +
    typography.body +
    4 +
    spacing.xs +
    typography.caption +
    2 +
    spacing.xs +
    stopSize;
  const showListeningHint =
    contentRoom >= listeningCoreHeight + spacing.xs + listeningHintLineHeight;

  const summaryParts = useMemo(() => {
    const parts: string[] = [];
    if (parsed.amount !== null) parts.push(formatDisplayMoneyAbsoluteExact(parsed.amount));
    if (parsed.merchant) parts.push(parsed.merchant);
    if (inferredType === 'expense' && matchedCategory?.name) parts.push(matchedCategory.name);
    if (parsed.accountLabel) parts.push(parsed.accountLabel);
    return parts;
  }, [inferredType, matchedCategory?.name, parsed.accountLabel, parsed.amount, parsed.merchant]);

  const handleConfirm = useCallback(() => {
    tapHaptic();

    const params: Record<string, string> = {};
    // Le type dépense est celui par défaut du formulaire : ne pas le forcer garde
    // le sélecteur Type visible pour une correction éventuelle.
    if (inferredType !== 'expense') params.type = inferredType;
    if (parsed.amount !== null) params.amount = String(parsed.amount);
    if (parsed.merchant) params.label = parsed.merchant;
    if (inferredType === 'expense' && parsed.categoryId) params.categoryId = parsed.categoryId;
    if (parsed.accountId) params.accountId = parsed.accountId;

    onClose();
    router.push({ pathname: '/add-transaction', params });
  }, [inferredType, onClose, parsed, router]);

  const handleRetry = useCallback(() => {
    tapHaptic();
    retry();
  }, [retry]);

  const handleStop = useCallback(() => {
    tapHaptic();
    stop();
  }, [stop]);

  /** Même chemin que backdrop / drag-dismiss : `onClose` → hook coupe le micro. */
  const handleClose = useCallback(() => {
    tapHaptic();
    onClose();
  }, [onClose]);

  const closeButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fermer"
      hitSlop={12}
      onPress={handleClose}
      style={({ pressed }) => [
        styles.closeButton,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <AppIcon family="ionicons" name="close" size={18} color={colors.textMuted} />
    </Pressable>
  );

  const sheetHandle = (
    <View style={styles.handleBar}>
      <View style={[styles.handlePill, { backgroundColor: colors.border }]} />
      {closeButton}
    </View>
  );

  function renderBody() {
    if (status === 'starting') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.text} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>Activation du micro…</Text>
          <Text style={[styles.stateHint, { color: colors.textMuted }]} numberOfLines={1}>
            {"Autorise l'accès si l'appareil le demande."}
          </Text>
        </View>
      );
    }

    if (status === 'listening') {
      return (
        <View style={styles.listeningLayout}>
          <MotiView
            from={{ opacity: 0.55, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 900, loop: true, repeatReverse: true }}
            style={[
              styles.listeningHalo,
              {
                width: haloSize,
                height: haloSize,
                borderRadius: haloSize / 2,
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.containerBorder,
              },
            ]}
          >
            <VoiceListeningWave
              level={level}
              color={colors.text}
              size={Math.round(haloSize * 0.48)}
            />
          </MotiView>

          <Text style={[styles.stateTitle, { color: colors.text }]}>{"J'écoute…"}</Text>
          <Text style={[styles.duration, { color: colors.textMuted }]}>
            {formatDuration(durationMillis)}
          </Text>

          <Pressable
            onPress={handleStop}
            accessibilityRole="button"
            accessibilityLabel="Arrêter l'écoute"
            style={({ pressed }) => [
              styles.stopButton,
              {
                width: stopSize,
                height: stopSize,
                borderRadius: stopSize / 2,
                // Même contraste que le FAB commande vocale (`colors.text` + glyphe `background`).
                backgroundColor: colors.text,
              },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.stopGlyph, { backgroundColor: colors.background }]} />
          </Pressable>
          {showListeningHint ? (
            <Text style={[styles.stateHint, { color: colors.textMuted }]} numberOfLines={1}>
              {silenceAutoStop ? "Je m'arrête quand tu as fini." : 'Touche pour arrêter.'}
            </Text>
          ) : null}
        </View>
      );
    }

    if (status === 'transcribing') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.text} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>Je transcris…</Text>
          <Text style={[styles.stateHint, { color: colors.textMuted }]} numberOfLines={1}>
            Analyse de ce que tu viens de dire.
          </Text>
        </View>
      );
    }

    if (status === 'error' && errorKind) {
      const copy = ERROR_COPY[errorKind];
      // Pas de titre « Dicter… » : uniquement le problème + Réessayer (+ X dans la poignée).
      return (
        <View style={styles.stack}>
          <View style={styles.errorCopy}>
            <Text style={[styles.stateTitle, { color: colors.text }]} numberOfLines={1}>
              {copy.title}
            </Text>
            <Text style={[styles.stateHint, { color: colors.textMuted }]} numberOfLines={2}>
              {copy.message}
            </Text>
          </View>
          <PrimarySaveButton label="Réessayer" onPress={handleRetry} style={styles.cta} />
        </View>
      );
    }

    if (status !== 'ready') return null;

    // Échec de parsing : même règle — pas de titre feuille, seulement le problème.
    if (!understood) {
      return (
        <View style={styles.stack}>
          <OnyxContainer halo={false} style={styles.transcriptShell}>
            <TextInput
              value={transcript}
              onChangeText={editTranscript}
              multiline={false}
              numberOfLines={1}
              placeholder="Transcription"
              placeholderTextColor={colors.textMuted}
              style={[styles.transcript, { color: colors.text }]}
              accessibilityLabel="Transcription — modifiable"
            />
          </OnyxContainer>
          <View style={styles.errorCopy}>
            <Text style={[styles.stateTitle, { color: colors.text }]} numberOfLines={1}>
              {"Je n'ai pas compris"}
            </Text>
            <Text style={[styles.stateHint, { color: colors.textMuted }]} numberOfLines={2}>
              {`Il me faut un montant ou un commerce. Corrige ou redis, par ex. ${DICTATION_EXAMPLE}.`}
            </Text>
          </View>
          <PrimarySaveButton label="Redire" onPress={handleRetry} style={styles.cta} />
        </View>
      );
    }

    // Récap réussi : type inféré, Confirmer seulement (pas de Redire / toggle).
    return (
      <View style={styles.stack}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Dicter une transaction</Text>

        <OnyxContainer halo={false} style={styles.transcriptShell}>
          <TextInput
            value={transcript}
            onChangeText={editTranscript}
            multiline={false}
            numberOfLines={1}
            placeholder="Transcription"
            placeholderTextColor={colors.textMuted}
            style={[styles.transcript, { color: colors.text }]}
            accessibilityLabel="Transcription — modifiable"
          />
        </OnyxContainer>

        <OnyxContainer halo={false} style={styles.summaryShell}>
          <Text style={[styles.summaryText, { color: colors.text }]} numberOfLines={2}>
            {summaryParts.join(' · ')}
          </Text>
        </OnyxContainer>

        <PrimarySaveButton label="Confirmer" onPress={handleConfirm} style={styles.cta} />
      </View>
    );
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      hideTitleRow
      handle={sheetHandle}
      heightRatio={heightRatio}
      scrollable={false}
      // Safe-area dans le corps ; le fill nav est géré par BottomSheet.
      sheetStyle={styles.sheet}
      scrollContentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingBottom: bodyBottomPadding,
        flex: 1,
      }}
    >
      <View style={styles.body}>
        <View style={styles.bodyMain}>{renderBody()}</View>
      </View>
    </BottomSheet>
  );
}

function formatDuration(millis: number): string {
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  sheet: {
    paddingBottom: 0,
  },
  /** Poignée centrée + X à droite — dans la zone de drag existante (pas de titleRow). */
  handleBar: {
    alignSelf: 'stretch',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  handlePill: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  closeButton: {
    position: 'absolute',
    right: spacing.lg,
    top: '50%',
    marginTop: -(CLOSE_BUTTON_SIZE / 2),
    width: CLOSE_BUTTON_SIZE,
    height: CLOSE_BUTTON_SIZE,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  bodyMain: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
  },
  stack: {
    gap: spacing.sm,
    justifyContent: 'center',
  },
  centered: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  /** Écoute : colonne centrée, pas de débordement sous le padding safe-area. */
  listeningLayout: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    // Respire au-dessus du paddingBottom du corps (safe area + md).
    paddingBottom: spacing.xs,
  },
  sheetTitle: {
    ...jakartaExtraBoldText,
    fontSize: typography.caption,
    textAlign: 'center',
    marginBottom: 2,
  },
  listeningHalo: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    ...jakartaExtraBoldText,
    fontSize: typography.body,
    textAlign: 'center',
  },
  stateHint: {
    ...jakartaMediumText,
    fontSize: typography.meta,
    lineHeight: typography.meta + 4,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  duration: {
    ...jakartaMediumText,
    fontSize: typography.caption,
    fontVariant: ['tabular-nums'],
  },
  stopButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopGlyph: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  errorCopy: {
    gap: 2,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  transcriptShell: {
    paddingHorizontal: ONYX_CONTAINER.padding.row,
    paddingVertical: spacing.sm,
  },
  transcript: {
    ...jakartaMediumText,
    fontSize: typography.caption,
    lineHeight: typography.caption + 4,
    padding: 0,
    margin: 0,
  },
  summaryShell: {
    paddingHorizontal: ONYX_CONTAINER.padding.row,
    paddingVertical: spacing.md,
  },
  summaryText: {
    ...jakartaExtraBoldText,
    fontSize: typography.caption,
    lineHeight: typography.caption + 4,
    textAlign: 'center',
  },
  cta: {
    paddingVertical: spacing.sm + 2,
  },
  pressed: { opacity: 0.7 },
});
