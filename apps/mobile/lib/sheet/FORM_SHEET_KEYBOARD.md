# Form sheet keyboard (Android) — do not regress

## Symptom this prevents

On Samsung / Android, opening the soft keyboard on a Modal form sheet makes the
**sheet chrome jump or shrink** (or vanish if double-avoided). Root causes:

1. `softwareKeyboardLayoutMode: "resize"` shrinking the Modal host, and/or
2. Subtracting IME inset from the panel height **and** padding the ScrollView, and/or
3. Wrapping Android sheets in `KeyboardAvoidingView` (double-shift).

## Rule

For form sheets in `apps/mobile/`:

1. Keep `android.softwareKeyboardLayoutMode: **"pan"**` in `app.json` (stable host height).
2. Wrap the Modal body in **`FormSheetModalBody`** (`lib/sheet/formSheetScroll.ts`).
3. Put the panel in **`DraggableSheetSurface`** / **`BottomSheet`** (they clamp to host).
4. **Stable panel height**: `FORM_SHEET_STABLE_ANDROID_PANEL_HEIGHT` — do **not** shrink
   the sheet by keyboard inset. Clear fields via ScrollView
   `formSheetScrollPaddingBottom(safeBottom, keyboardInset)` only.
5. On **Android**: never enable `KeyboardAvoidingView` `behavior` / padding / height
   around these sheets. iOS may use KAV padding (handled inside `FormSheetModalBody`).
6. Header chrome: use **`FormSheetChromeHeader`** / `lib/sheet/formSheetChrome.ts`
   (tight handle → title gap). Do not reinflate handle hit layout to 56px.
7. Do **not** modify `TransactionDetailSheet.tsx` unless explicitly requested.

## Clamp helpers (unit-tested)

- `clampFormSheetKeyboardInset` — caps inset for **scroll padding**
- `formSheetHostAlreadyResized` — detects leftover adjustResize; fit host only
- `formSheetKeyboardClampedHeight` / `formSheetMaxHeight` — stable panel by default

Run: `npx --yes tsx --tsconfig tsconfig.json lib/sheet/formSheetKeyboardMath.test.ts`
