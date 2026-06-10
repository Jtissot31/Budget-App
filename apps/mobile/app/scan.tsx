import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { SurfaceCard } from '@/components/SurfaceCard';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { ReceiptCaptureActions } from '@/components/ReceiptCaptureActions';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { containerSurfaceStyle, interExtraBoldText, radius, spacing, typography } from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';
import { getCategories } from '@/lib/db';
import { formValidationError } from '@/lib/formFeedback';
import { tapHaptic, successHaptic } from '@/lib/haptics';
import { captureReceiptPhoto, pickReceiptFromGallery } from '@/lib/receiptCapture';
import {
  mapScannedItemsToCategories,
  scanReceiptImage,
  serializeScanItemsForRoute,
} from '@/lib/receiptScan';
import { useAppTheme } from '@/lib/themeContext';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import type { Category } from '@/types';
import type { ItemizedNote } from '@/lib/itemizedNote';

type ScanPhase = 'idle' | 'processing' | 'review';

export default function ScanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    editId?: string;
    merchant?: string;
    amount?: string;
    label?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const surface = containerSurfaceStyle(isLight);

  const editId = typeof params.editId === 'string' ? params.editId : '';
  const merchantHint =
    (typeof params.merchant === 'string' ? params.merchant : '') ||
    (typeof params.label === 'string' ? params.label : '');
  const totalHint = typeof params.amount === 'string' ? parseFloat(params.amount.replace(',', '.')) : 0;

  const [categories, setCategories] = useState<Category[]>([]);
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [imageUri, setImageUri] = useState('');
  const [items, setItems] = useState<ItemizedNote[]>([]);
  const [scanSource, setScanSource] = useState<'api' | 'text' | 'heuristic' | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    void getCategories().then(setCategories);
  }, []);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.price, 0), [items]);

  const processImage = useCallback(
    async (uri: string) => {
      if (!uri) return;
      setError(null);
      setImageUri(uri);
      setPhase('processing');

      await new Promise((resolve) => setTimeout(resolve, 450));

      try {
        const result = await scanReceiptImage(uri, {
          merchantHint,
          totalHint: Number.isFinite(totalHint) && totalHint > 0 ? totalHint : undefined,
        });
        const mapped = mapScannedItemsToCategories(result.items, categories, merchantHint);
        setItems(mapped);
        setScanSource(result.source);
        setPhase('review');
      } catch {
        setError(formValidationError('Analyse impossible', 'Réessaie avec une photo plus nette.'));
        setPhase('idle');
      }
    },
    [categories, merchantHint, totalHint],
  );

  const handleCapture = async () => {
    try {
      const result = await captureReceiptPhoto();
      if (result.cancelled || !result.uri) return;
      await processImage(result.uri);
    } catch (err) {
      setError(formValidationError('Permission requise', err instanceof Error ? err.message : 'Accès caméra refusé.'));
    }
  };

  const handleImport = async () => {
    try {
      const result = await pickReceiptFromGallery();
      if (result.cancelled || !result.uri) return;
      await processImage(result.uri);
    } catch (err) {
      setError(formValidationError('Permission requise', err instanceof Error ? err.message : 'Accès galerie refusé.'));
    }
  };

  const handleScan = async () => {
    tapHaptic();
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError(formValidationError('Permission requise', 'Autorise la caméra pour scanner un reçu.'));
      return;
    }
    await handleCapture();
  };

  const continueWithResults = () => {
    if (items.length === 0) {
      setError(formValidationError('Aucun article', 'Scanne à nouveau ou ajoute les articles manuellement.'));
      return;
    }

    successHaptic();
    const serializedItems = serializeScanItemsForRoute(items);

    if (editId) {
      router.replace({
        pathname: '/add-transaction',
        params: {
          editId,
          scanItems: serializedItems,
          receiptUri: imageUri,
          merchant: merchantHint,
        },
      });
      return;
    }

    router.replace({
      pathname: '/add-transaction',
      params: {
        scanItems: serializedItems,
        receiptUri: imageUri,
        label: merchantHint,
        amount: total > 0 ? String(total) : totalHint > 0 ? String(totalHint) : '',
      },
    });
  };

  return (
    <PageTransition>
      <View style={[styles.screen, { paddingTop: insets.top + SCREEN_TOP_GUTTER, paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, surface, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Scanner un reçu</Text>
          <View style={styles.topSpacer} />
        </View>

        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Photo → extraction des articles → catégories budgétaires en quelques secondes.
        </Text>

        {phase === 'processing' ? (
          <SurfaceCard innerStyle={styles.processingInner} padding={spacing.lg}>
            {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} contentFit="cover" /> : null}
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.processingText, { color: colors.text }]}>Analyse du reçu…</Text>
          </SurfaceCard>
        ) : null}

        {phase === 'idle' ? (
          <>
            <ReceiptCaptureActions onScan={() => void handleScan()} onCapture={() => void handleCapture()} onImport={() => void handleImport()} />
            <SurfaceCard innerStyle={styles.tipInner} padding={spacing.md}>
              <Ionicons name="flash-outline" size={16} color={colors.primary} />
              <Text style={[styles.tipText, { color: colors.textMuted }]}>
                Place le reçu à plat, avec le texte lisible. Les articles seront pré-remplis automatiquement.
              </Text>
            </SurfaceCard>
          </>
        ) : null}

        {phase === 'review' ? (
          <View style={styles.review}>
            {imageUri ? <Image source={{ uri: imageUri }} style={styles.previewCompact} contentFit="cover" /> : null}
            <View style={styles.reviewHeader}>
              <Text style={[styles.reviewTitle, { color: colors.text }]}>
                {items.length} article{items.length > 1 ? 's' : ''} détecté{items.length > 1 ? 's' : ''}
              </Text>
              {scanSource === 'heuristic' ? (
                <Text style={[styles.reviewHint, { color: colors.textMuted }]}>Estimation — vérifie avant d'enregistrer</Text>
              ) : null}
            </View>
            <SurfaceCard innerStyle={styles.itemsInner} padding={spacing.md}>
              {items.map((item, index) => (
                <View
                  key={`${item.name}-${index}`}
                  style={[styles.itemRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}
                >
                  <View style={styles.itemCopy}>
                    <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {item.categoryName ? (
                      <Text style={[styles.itemCategory, { color: colors.textMuted }]} numberOfLines={1}>
                        {item.categoryName}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.itemPrice, { color: colors.text }]}>
                    {formatDisplayMoneyAbsolute(item.price)}
                  </Text>
                </View>
              ))}
            </SurfaceCard>
            {total > 0 ? (
              <Text style={[styles.totalLine, { color: colors.textMuted }]}>Total détecté : {formatDisplayMoneyAbsolute(total)} $</Text>
            ) : null}
            <PrimarySaveButton label="Utiliser ces articles" onPress={continueWithResults} />
            <Pressable
              onPress={() => {
                tapHaptic();
                setPhase('idle');
                setItems([]);
                setImageUri('');
              }}
              style={({ pressed }) => [styles.rescanBtn, pressed && styles.pressed]}
            >
              <Text style={[styles.rescanText, { color: colors.primary }]}>Scanner à nouveau</Text>
            </Pressable>
          </View>
        ) : null}

        {error ? <ThemedFormMessage variant="error" title={error.title} message={error.message} /> : null}
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    ...interExtraBoldText,
    fontSize: typography.title,
    letterSpacing: -0.4,
  },
  topSpacer: {
    width: 38,
  },
  subtitle: {
    ...typographyKit.metaMedium,
    lineHeight: 20,
  },
  processingInner: {
    alignItems: 'center',
    gap: spacing.md,
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: radius.lg,
  },
  previewCompact: {
    width: '100%',
    height: 120,
    borderRadius: radius.lg,
  },
  processingText: {
    ...typographyKit.caption,
  },
  tipInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  tipText: {
    flex: 1,
    ...typographyKit.metaMedium,
    lineHeight: 19,
  },
  review: {
    gap: spacing.sm,
  },
  reviewHeader: {
    gap: 2,
  },
  reviewTitle: {
    ...typographyKit.sectionTitle,
    fontSize: typography.body,
  },
  reviewHint: {
    ...typographyKit.microMedium,
  },
  itemsInner: {
    gap: 0,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    ...typographyKit.rowTitle,
  },
  itemCategory: {
    ...typographyKit.microMedium,
    marginTop: 2,
  },
  itemPrice: {
    ...typographyKit.rowAmount,
  },
  totalLine: {
    ...typographyKit.metaMedium,
    textAlign: 'right',
  },
  rescanBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  rescanText: {
    ...typographyKit.caption,
  },
  pressed: {
    opacity: 0.72,
  },
});
