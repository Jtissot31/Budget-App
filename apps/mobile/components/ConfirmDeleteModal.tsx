import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {

  jakartaBoldText,

  jakartaMediumText,

  radius,

  spacing,

  typography,

} from '@/constants/theme';

import { useAppTheme } from '@/lib/themeContext';



type Props = {

  visible: boolean;

  title: string;

  message?: string;

  confirmLabel?: string;

  cancelLabel?: string;

  /** Render as an in-modal overlay (e.g. inside another `Modal`) instead of a nested `Modal`. */

  embedded?: boolean;

  onConfirm: () => void;

  onCancel: () => void;

};



function ConfirmDeleteDialog({

  title,

  message,

  confirmLabel = 'Supprimer',

  cancelLabel = 'Annuler',

  onConfirm,

  onCancel,

}: Omit<Props, 'visible' | 'embedded'>) {

  const { colors } = useAppTheme();



  return (

    <View style={styles.backdrop}>

      <Pressable

        style={StyleSheet.absoluteFill}

        onPress={onCancel}

        accessibilityRole="button"

        accessibilityLabel="Fermer"

      />

      <View

        style={[

          styles.card,

          {

            backgroundColor: colors.containerBackground,

            borderColor: colors.containerBorder,

          },

        ]}

      >

        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceElevated }]}>

          <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />

        </View>

        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

        {message ? (

          <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>

        ) : null}

        <View style={styles.actions}>

          <Pressable

            accessibilityRole="button"

            accessibilityLabel={confirmLabel}

            style={({ pressed }) => [

              styles.actionBtn,

              {

                backgroundColor: colors.input,

                borderColor: colors.containerBorder,

              },

              pressed && styles.pressed,

            ]}

            onPress={onConfirm}

          >

            <Text style={[styles.confirmText, { color: colors.danger }]}>{confirmLabel}</Text>

          </Pressable>

          <Pressable

            accessibilityRole="button"

            accessibilityLabel={cancelLabel}

            style={({ pressed }) => [

              styles.actionBtn,

              {

                backgroundColor: colors.input,

                borderColor: colors.containerBorder,

              },

              pressed && styles.pressed,

            ]}

            onPress={onCancel}

          >

            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>{cancelLabel}</Text>

          </Pressable>

        </View>

      </View>

    </View>

  );

}



export function ConfirmDeleteModal({

  visible,

  embedded = false,

  ...dialogProps

}: Props) {

  if (!visible) return null;



  if (embedded) {

    return <ConfirmDeleteDialog {...dialogProps} />;

  }



  return (

    <Modal

      visible={visible}

      transparent

      animationType="fade"

      onRequestClose={dialogProps.onCancel}

    >

      <ConfirmDeleteDialog {...dialogProps} />

    </Modal>

  );

}



const styles = StyleSheet.create({

  backdrop: {

    ...StyleSheet.absoluteFillObject,

    backgroundColor: 'rgba(0, 0, 0, 0.72)',

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: spacing.xl,

  },

  card: {

    width: '100%',

    maxWidth: 340,

    borderRadius: radius.card + 4,

    borderWidth: 1,

    padding: spacing.xl,

    alignItems: 'center',

    gap: spacing.md,

  },

  iconWrap: {

    width: 48,

    height: 48,

    borderRadius: 16,

    alignItems: 'center',

    justifyContent: 'center',

  },

  title: {

    ...jakartaBoldText,

    fontSize: typography.body,

    textAlign: 'center',

  },

  message: {

    ...jakartaMediumText,

    fontSize: typography.caption,

    lineHeight: typography.caption + 6,

    textAlign: 'center',

  },

  actions: {

    alignSelf: 'stretch',

    gap: spacing.sm,

    marginTop: spacing.sm,

  },

  actionBtn: {

    alignSelf: 'stretch',

    minHeight: 44,

    borderRadius: radius.lg,

    borderWidth: StyleSheet.hairlineWidth,

    alignItems: 'center',

    justifyContent: 'center',

    paddingVertical: spacing.md,

  },

  confirmText: {

    ...jakartaBoldText,

    fontSize: typography.caption,

  },

  cancelText: {

    ...jakartaMediumText,

    fontSize: typography.caption,

  },

  pressed: {

    opacity: 0.82,

  },

});

