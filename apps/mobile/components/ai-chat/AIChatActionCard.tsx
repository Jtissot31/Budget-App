import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import {
  planFinanceEyebrowStyle,
  planFinanceFonts,
  planFinanceKit,
  planFinancePrimaryButtonStyle,
  planFinanceSecondaryButtonStyle,
} from '@/constants/planFinanceKit';
import { interSemiboldText, moneyAmountTypography, spacing } from '@/constants/theme';
import type { ChatAction } from '@/lib/ai/types';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

import type { AIChatUiAction } from './types';

export type { AIChatActionState, AIChatUiAction } from './types';

type Props = {
  action: AIChatUiAction;
  onConfirm: (actionKey: string) => void;
  onCancel: (actionKey: string) => void;
  disabled?: boolean;
};

/** French Canadian money fragments inside confirmation copy (e.g. `10 000 $`, `400 $/mois`). */
const CONFIRMATION_MONEY_REGEX =
  /(?:[\d][\d\s]*(?:,\d{1,2})?\s*(?:\$|CAD)(?:\s*\/\s*(?:mois|semaine|an))?|\$\s*[\d][\d\s]*(?:,\d{1,2})?)/gi;

function actionTypeLabel(action: ChatAction['action']): string {
  const labels: Partial<Record<ChatAction['action'], string>> = {
    creer_objectif: 'Objectif',
    modifier_objectif: 'Objectif',
    creer_categorie_budget: 'Catégorie budget',
    modifier_categorie_budget: 'Catégorie budget',
    creer_compte: 'Compte',
    modifier_compte: 'Compte',
    creer_marchand: 'Marchand',
    modifier_marchand: 'Marchand',
    creer_patrimoine: 'Patrimoine',
    modifier_patrimoine: 'Patrimoine',
    creer_pret: 'Prêt',
    modifier_pret: 'Prêt',
    creer_transaction: 'Transaction',
    modifier_transaction: 'Transaction',
    creer_paiement_recurrent: 'Paiement récurrent',
    modifier_paiement_recurrent: 'Paiement récurrent',
    creer_alerte: 'Alerte',
  };
  return labels[action] ?? 'Action';
}

function splitConfirmationText(text: string): { kind: 'text' | 'money'; value: string }[] {
  const segments: { kind: 'text' | 'money'; value: string }[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(CONFIRMATION_MONEY_REGEX)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, start) });
    }
    segments.push({ kind: 'money', value: match[0] });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return segments.length ? segments : [{ kind: 'text', value: text }];
}

function ConfirmationCopy({ text, color }: { text: string; color: string }) {
  const segments = splitConfirmationText(text);

  return (
    <Text style={[planFinanceFonts.cardTitle, { color }]}>
      {segments.map((segment, index) =>
        segment.kind === 'money' ? (
          <Text key={`money-${index}`} style={moneyAmountTypography({ tier: 'card', fontSize: 16, lineHeight: 22 })}>
            {segment.value}
          </Text>
        ) : (
          <Fragment key={`text-${index}`}>{segment.value}</Fragment>
        ),
      )}
    </Text>
  );
}

export function AIChatActionCard({ action, onConfirm, onCancel, disabled = false }: Props) {
  const { colors } = useAppTheme();
  const isPending = action.status === 'pending';
  const isExecuting = action.status === 'executing';
  const isTerminal = action.status === 'success' || action.status === 'error' || action.status === 'cancelled';

  return (
    <PlanFinanceContainer halo={false} style={styles.card}>
      <Text style={planFinanceEyebrowStyle()}>{actionTypeLabel(action.action)}</Text>

      <ConfirmationCopy text={action.confirmation} color={colors.text} />

      {action.resultMessage ? (
        <Text
          style={[
            planFinanceFonts.cardMeta,
            {
              color:
                action.status === 'error'
                  ? planFinanceKit.colors.danger
                  : action.status === 'success'
                    ? colors.accentGreen
                    : colors.textSecondary,
            },
          ]}
        >
          {action.resultMessage}
        </Text>
      ) : null}

      {isPending ? (
        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Annuler l'action"
            disabled={disabled || isExecuting}
            onPress={() => {
              tapHaptic();
              onCancel(action.actionKey);
            }}
            style={({ pressed }) => [
              styles.button,
              planFinanceSecondaryButtonStyle(),
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }, interSemiboldText]}>
              Annuler
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirmer l'action"
            disabled={disabled || isExecuting}
            onPress={() => {
              tapHaptic();
              onConfirm(action.actionKey);
            }}
            style={({ pressed }) => [
              styles.button,
              planFinancePrimaryButtonStyle(),
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.primaryButtonText, interSemiboldText]}>
              {isExecuting ? 'En cours…' : 'Confirmer'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {isTerminal && action.status === 'cancelled' ? (
        <Text style={[planFinanceFonts.cardMeta, { color: colors.textSecondary }]}>Action annulée.</Text>
      ) : null}
    </PlanFinanceContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: planFinanceKit.layout.cardPadding,
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  button: {
    flex: 1,
  },
  secondaryButtonText: {
    fontSize: 15,
  },
  primaryButtonText: {
    fontSize: 15,
    color: planFinanceKit.colors.textOnAccent,
  },
  pressed: {
    opacity: 0.82,
  },
});
