import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { jakartaMediumText, jakartaRegularText, radius, spacing, typography } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import type { ChatAction } from '@/lib/ai/types';
import { useAIChatColors } from './theme';
import type { AIChatUiAction } from './types';

export type { AIChatActionState, AIChatUiAction } from './types';

type Props = {
  action: AIChatUiAction;
  onConfirm: (actionKey: string) => void;
  onCancel: (actionKey: string) => void;
  disabled?: boolean;
};

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

export function AIChatActionCard({ action, onConfirm, onCancel, disabled = false }: Props) {
  const palette = useAIChatColors();
  const isPending = action.status === 'pending';
  const isExecuting = action.status === 'executing';
  const isTerminal = action.status === 'success' || action.status === 'error' || action.status === 'cancelled';

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.headerRow}>
        <AppIcon family="material-community" 
          name={isPending || isExecuting ? 'lightning-bolt-outline' : 'check-circle-outline'}
          size={18}
          color={palette.primary}
        />
        <Text style={[styles.actionType, { color: palette.textMuted }, jakartaRegularText]}>
          {actionTypeLabel(action.action)}
        </Text>
      </View>

      <Text style={[styles.confirmation, { color: palette.text }, jakartaRegularText]}>
        {action.confirmation}
      </Text>

      {action.resultMessage ? (
        <Text
          style={[
            styles.result,
            {
              color:
                action.status === 'error'
                  ? '#EF4444'
                  : action.status === 'success'
                    ? palette.primary
                    : palette.textMuted,
            },
            jakartaRegularText,
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
              styles.secondaryButton,
              { borderColor: palette.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.secondaryButtonText, { color: palette.textMuted }, jakartaMediumText]}>
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
              styles.primaryButton,
              { backgroundColor: palette.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.primaryButtonText, { color: palette.userBubbleText }, jakartaMediumText]}>
              {isExecuting ? 'En cours…' : 'Confirmer'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {isTerminal && action.status === 'cancelled' ? (
        <Text style={[styles.result, { color: palette.textMuted }, jakartaRegularText]}>Action annulée.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionType: {
    fontSize: typography.meta,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  confirmation: {
    fontSize: typography.body,
    lineHeight: typography.body + 6,
  },
  result: {
    fontSize: typography.meta,
    lineHeight: typography.meta + 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryButtonText: {
    fontSize: typography.body,
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  primaryButtonText: {
    fontSize: typography.body,
  },
  pressed: {
    opacity: 0.78,
  },
});
