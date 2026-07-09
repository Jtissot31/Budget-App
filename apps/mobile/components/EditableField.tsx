import { useCallback, useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { MinimalDatePicker } from '@/components/MinimalDatePicker';
import { SettingsPickerSheet, type SettingsPickerOption } from '@/components/SettingsPickerSheet';
import { formatFriendlyDateLabel } from '@/lib/formatFriendlyDateLabel';
import { toLocalDateInputValue } from '@/lib/localDateInput';
import { moneyAmountTypography, radius, spacing, typographyKit } from '@/constants/theme';
import { detailRowSelectValueTextProps } from '@/lib/textLayout';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { parseFormattedNumber } from '@/lib/formatNumber';
import { isHandledSaveError } from '@/lib/editableSaveError';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

export type EditableFieldType = 'text' | 'money' | 'icon' | 'select' | 'date';

export type EditableFieldHandle = {
  startEditing: () => void;
};

type Props = {
  value: string;
  onSave: (newValue: string) => Promise<void> | void;
  type?: EditableFieldType;
  textStyle?: StyleProp<TextStyle>;
  placeholder?: string;
  accessibilityLabel?: string;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  align?: 'left' | 'right';
  multiline?: boolean;
  allowEmpty?: boolean;
  selectedId?: string;
  selectOptions?: SettingsPickerOption<string>[];
  pickerTitle?: string;
  /** ISO date string → display label when type is `date`. */
  formatDateLabel?: (isoDate: string) => string;
  /** Ref attached to the field wrapper — use with parent scroll-into-view. */
  fieldRef?: RefObject<View | null>;
  /** Imperative handle — e.g. header + button to focus the same inline field. */
  editHandleRef?: RefObject<EditableFieldHandle | null>;
  /** Called when inline edit mode begins (before focus). Use to scroll parent. */
  onEditStart?: () => void;
  /** Called when the text input receives focus (e.g. after keyboard opens). */
  onFocusEdit?: () => void;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SAVED_FLASH_MS = 1200;

export function EditableField({
  value,
  onSave,
  type = 'text',
  textStyle,
  placeholder,
  accessibilityLabel,
  containerStyle,
  disabled = false,
  align = 'left',
  multiline = false,
  allowEmpty = false,
  selectedId = '',
  selectOptions = [],
  pickerTitle = 'Choisir',
  formatDateLabel,
  fieldRef,
  editHandleRef,
  onEditStart,
  onFocusEdit,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const inputRef = useRef<TextInput>(null);
  const commitInFlightRef = useRef(false);
  const editingRef = useRef(false);
  const commitSaveRef = useRef<(() => Promise<void>) | null>(null);
  const [editing, setEditing] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  editingRef.current = editing;

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [value, editing]);

  useEffect(
    () => () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    },
    [],
  );

  const displayValue =
    type === 'money'
      ? formatDisplayMoneyAbsolute(Math.max(0, parseFormattedNumber(value) || 0))
      : type === 'date'
        ? (formatDateLabel?.(value) ?? formatFriendlyDateLabel(toLocalDateInputValue(value)))
        : type === 'select'
          ? (selectOptions.find((option) => option.id === selectedId)?.label?.trim()
              || (value.trim() && !/^\d+$/.test(value.trim()) ? value : ''))
          : value;

  const validate = useCallback(
    (raw: string): string | null => {
      if (type === 'money') {
        const parsed = parseFormattedNumber(raw);
        if (!Number.isFinite(parsed) || parsed < 0) {
          return 'Montant invalide';
        }
      } else if (type === 'text' && !allowEmpty) {
        if (!raw.trim()) return 'Champ requis';
      }
      return null;
    },
    [allowEmpty, type],
  );

  const runSave = useCallback(
    async (nextValue: string) => {
      setSaveState('saving');
      setErrorHint(null);
      try {
        await onSave(nextValue);
        setSaveState('saved');
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaveState('idle'), SAVED_FLASH_MS);
      } catch (err) {
        if (isHandledSaveError(err)) {
          setSaveState('idle');
        } else {
          setSaveState('error');
          setErrorHint('Enregistrement impossible');
        }
        throw err;
      }
    },
    [onSave],
  );

  const commitSave = useCallback(async () => {
    if (commitInFlightRef.current || !editingRef.current) return;
    commitInFlightRef.current = true;
    editingRef.current = false;

    try {
      const validationError = validate(draft);
      if (validationError) {
        setErrorHint(validationError);
        setDraft(value);
        setEditing(false);
        setSaveState('error');
        return;
      }

      const normalized = type === 'text' && !multiline ? draft.trim() : draft;
      if (normalized === value) {
        setEditing(false);
        setErrorHint(null);
        return;
      }

      setEditing(false);
      await runSave(normalized);
    } catch {
      setDraft(value);
    } finally {
      commitInFlightRef.current = false;
    }
  }, [draft, multiline, runSave, type, validate, value]);

  commitSaveRef.current = commitSave;

  const deferFocusForScroll = Boolean(onEditStart);

  useEffect(() => {
    if (!editing || type === 'select') return;

    const focusDelayMs = deferFocusForScroll ? (multiline ? 200 : 80) : 0;
    const frame = requestAnimationFrame(() => {
      setTimeout(() => inputRef.current?.focus(), focusDelayMs);
    });

    return () => cancelAnimationFrame(frame);
  }, [deferFocusForScroll, editing, type]);

  useEffect(() => {
    if (!editing || Platform.OS === 'web' || multiline) return;

    const subscription = Keyboard.addListener('keyboardDidHide', () => {
      if (editingRef.current) {
        void commitSaveRef.current?.();
      }
    });

    return () => subscription.remove();
  }, [editing, multiline]);

  const openSelectPicker = useCallback(() => {
    if (disabled) return;
    tapHaptic();
    setErrorHint(null);
    setPickerVisible(true);
  }, [disabled]);

  const openDatePicker = useCallback(() => {
    if (disabled) return;
    tapHaptic();
    setErrorHint(null);
    setPickerVisible(true);
  }, [disabled]);

  const startEditing = useCallback(() => {
    if (disabled || type === 'icon') return;
    if (type === 'select') {
      openSelectPicker();
      return;
    }
    if (type === 'date') {
      openDatePicker();
      return;
    }
    tapHaptic();
    setDraft(value);
    setErrorHint(null);
    setSaveState('idle');
    setEditing(true);
    onEditStart?.();
  }, [disabled, onEditStart, openDatePicker, openSelectPicker, type, value]);

  useImperativeHandle(editHandleRef, () => ({ startEditing }), [startEditing]);

  const handleSelect = useCallback(
    async (id: string) => {
      if (id === selectedId) return;
      try {
        await runSave(id);
      } catch {
        // error state handled in runSave
      }
    },
    [runSave, selectedId],
  );

  const handleDateConfirm = useCallback(
    async (nextDayYmd: string) => {
      setPickerVisible(false);
      if (nextDayYmd === toLocalDateInputValue(value)) return;
      try {
        await runSave(nextDayYmd);
      } catch {
        // error state handled in runSave
      }
    },
    [runSave, value],
  );

  const handleBlur = useCallback(() => {
    void commitSave();
  }, [commitSave]);

  const handleFocus = useCallback(() => {
    onFocusEdit?.();
    if (Platform.OS === 'web') {
      const node = inputRef.current as unknown as { scrollIntoView?: (options?: ScrollIntoViewOptions) => void } | null;
      node?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }
  }, [onFocusEdit]);

  const handleSubmitEditing = useCallback(() => {
    if (multiline) {
      inputRef.current?.blur();
      return;
    }
    inputRef.current?.blur();
  }, [multiline]);

  const inputStyles = [
    styles.input,
    multiline && styles.inputMultiline,
    type === 'money' ? moneyAmountTypography() : null,
    align === 'right' ? styles.inputRight : null,
    textStyle,
    {
      color: colors.text,
      backgroundColor: isLight ? colors.input : colors.input,
      borderColor: colors.border,
    },
  ];

  const affordanceBg = isLight ? 'rgba(10, 10, 10, 0.04)' : 'rgba(255, 255, 255, 0.06)';

  return (
    <View ref={fieldRef} style={[styles.wrapper, containerStyle]} collapsable={false}>
      {editing ? (
        type === 'money' ? (
          <NumericAmountInput
            ref={inputRef}
            autoFocus={!deferFocusForScroll}
            value={draft}
            onChangeText={setDraft}
            onBlur={handleBlur}
            onFocus={handleFocus}
            onSubmitEditing={handleSubmitEditing}
            returnKeyType="done"
            blurOnSubmit
            style={inputStyles}
            placeholder={placeholder}
            accessibilityLabel={accessibilityLabel}
          />
        ) : (
          <TextInput
            ref={inputRef}
            autoFocus={!deferFocusForScroll}
            value={draft}
            onChangeText={setDraft}
            onBlur={handleBlur}
            onFocus={handleFocus}
            onSubmitEditing={handleSubmitEditing}
            returnKeyType={multiline ? 'default' : 'done'}
            blurOnSubmit={!multiline}
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
            keyboardType="default"
            style={inputStyles}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={accessibilityLabel}
          />
        )
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? `Modifier ${displayValue || placeholder || ''}`}
          disabled={disabled}
          onPress={startEditing}
          style={({ pressed }) => [
            styles.displayPressable,
            (type === 'text' || multiline || type === 'select' || type === 'date' || align === 'right')
              && styles.displayPressableStretch,
            (type === 'select' || type === 'date' || align === 'right') && styles.displayPressableRight,
            type === 'select' && styles.displayPressableSelect,
            { backgroundColor: pressed || saveState === 'saved' ? affordanceBg : 'transparent' },
            disabled && styles.disabled,
          ]}
        >
          <Text
            style={[
              type === 'money' ? moneyAmountTypography() : null,
              multiline ? typographyKit.metaMedium : null,
              (type === 'select' || type === 'date' || (type === 'money' && align === 'right'))
                ? styles.selectValueText
                : null,
              textStyle,
              {
                color: displayValue ? colors.text : colors.textMuted,
              },
            ]}
            {...(multiline
              ? {}
              : type === 'select' || type === 'date'
                ? detailRowSelectValueTextProps
                : type === 'text'
                  ? { numberOfLines: 2 as const, ellipsizeMode: 'tail' as const }
                  : { numberOfLines: 1 as const, ellipsizeMode: 'tail' as const })}
          >
            {displayValue || placeholder}
          </Text>
          {type === 'select' ? (
            <AppIcon family="ionicons" name="chevron-down" size={14} color={colors.textMuted} style={styles.selectIndicator} />
          ) : saveState === 'saving' ? (
            <ActivityIndicator size="small" color={colors.textMuted} style={styles.indicator} />
          ) : saveState === 'saved' ? (
            <AppIcon family="ionicons" name="checkmark" size={14} color={colors.accentGreen} style={styles.indicator} />
          ) : null}
        </Pressable>
      )}
      {errorHint ? (
        <Text style={[styles.errorHint, { color: colors.danger }]} numberOfLines={1}>
          {errorHint}
        </Text>
      ) : null}
      {type === 'select' ? (
        <SettingsPickerSheet
          visible={pickerVisible}
          title={pickerTitle}
          options={selectOptions}
          selectedId={selectedId}
          onClose={() => setPickerVisible(false)}
          onSelect={(id) => void handleSelect(id)}
        />
      ) : null}
      {type === 'date' ? (
        <MinimalDatePicker
          visible={pickerVisible}
          value={toLocalDateInputValue(value)}
          allowClear={false}
          onCancel={() => setPickerVisible(false)}
          onConfirm={(nextDayYmd) => void handleDateConfirm(nextDayYmd)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minWidth: 0,
  },
  displayPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  displayPressableStretch: {
    alignSelf: 'stretch',
  },
  displayPressableRight: {
    alignSelf: 'stretch',
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
  },
  displayPressableSelect: {
    alignItems: 'flex-start',
    width: '100%',
  },
  selectValueText: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'right',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    minWidth: 48,
    maxWidth: '100%',
  },
  inputMultiline: {
    minHeight: 72,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  inputRight: {
    alignSelf: 'flex-end',
    textAlign: 'right',
  },
  indicator: {
    flexShrink: 0,
  },
  selectIndicator: {
    flexShrink: 0,
    width: 14,
    marginTop: 3,
  },
  errorHint: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
    paddingHorizontal: spacing.xs,
  },
  disabled: {
    opacity: 0.5,
  },
});
